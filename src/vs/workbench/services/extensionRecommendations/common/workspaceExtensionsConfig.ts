/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { distinct } from '../../../../base/common/arrays.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { JSONPath, parse } from '../../../../base/common/json.js';
import { combinedDisposable, Disposable, IDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { getIconClasses } from '../../../../editor/common/services/getIconClasses.js';
import { FileChangeType, FileChangesEvent, FileKind, FileOperation, FileOperationEvent, IFileService } from '../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { isWorkspace, IWorkspace, IWorkspaceContextService, IWorkspaceFolder } from '../../../../platform/workspace/common/workspace.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IMarkerService, IResourceMarker } from '../../../../platform/markers/common/markers.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { isObject } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { IJSONEditingService, IJSONValue } from '../../configuration/common/jsonEditing.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { ConfigurationFileInheritance } from '../../configuration/common/configurationInheritance.js';

export const EXTENSIONS_CONFIG = '.vscode/extensions.json';

export interface IExtensionsConfigContent {
	recommendations?: string[];
	unwantedRecommendations?: string[];
}

export const IWorkspaceExtensionsConfigService = createDecorator<IWorkspaceExtensionsConfigService>('IWorkspaceExtensionsConfigService');

export interface IWorkspaceExtensionsConfigService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeExtensionsConfigs: Event<void>;
	getExtensionsConfigs(): Promise<IExtensionsConfigContent[]>;
	getRecommendations(): Promise<string[]>;
	getUnwantedRecommendations(): Promise<string[]>;

	toggleRecommendation(extensionId: string): Promise<void>;
	toggleUnwantedRecommendation(extensionId: string): Promise<void>;
}

export class WorkspaceExtensionsConfigService extends Disposable implements IWorkspaceExtensionsConfigService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeExtensionsConfigs = this._register(new Emitter<void>());
	readonly onDidChangeExtensionsConfigs = this._onDidChangeExtensionsConfigs.event;
	private readonly watchedResources = this._register(new MutableDisposable<IDisposable>());
	private extensionsConfigurationResources: URI[] = [];
	private readonly inheritanceDiagnostics = new Map<string, IResourceMarker[]>();

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IModelService private readonly modelService: IModelService,
		@ILanguageService private readonly languageService: ILanguageService,
		@IJSONEditingService private readonly jsonEditingService: IJSONEditingService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@IMarkerService private readonly markerService: IMarkerService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._register(toDisposable(() => this.clearInheritanceDiagnostics()));
		this._register(workspaceContextService.onDidChangeWorkspaceFolders(() => {
			this.pruneInheritanceDiagnosticsForCurrentWorkspace();
			this._onDidChangeExtensionsConfigs.fire();
		}));
		this._register(fileService.onDidFilesChange(e => {
			if (this.handleFileChangesEvent(e)) {
				this._onDidChangeExtensionsConfigs.fire();
			}
		}));
		this._register(fileService.onDidRunOperation(e => {
			if (this.handleFileOperationEvent(e)) {
				this._onDidChangeExtensionsConfigs.fire();
			}
		}));
	}

	async getExtensionsConfigs(): Promise<IExtensionsConfigContent[]> {
		const workspace = this.workspaceContextService.getWorkspace();
		const result: IExtensionsConfigContent[] = [];
		const resources = new ResourceMap<URI>();
		const activeDiagnosticOwners = new Set<string>();
		const workspaceExtensionsConfig = workspace.configuration ? await this.resolveWorkspaceExtensionConfig(workspace.configuration) : undefined;
		if (workspaceExtensionsConfig) {
			for (const resource of workspaceExtensionsConfig.resources) {
				resources.set(resource, resource);
			}
			activeDiagnosticOwners.add(this.updateInheritanceDiagnostics(workspaceExtensionsConfig.configurationResource, workspaceExtensionsConfig.diagnostics));
			if (workspaceExtensionsConfig.content) {
				result.push(workspaceExtensionsConfig.content);
			}
		}
		for (const folderExtensionsConfig of await Promise.all(workspace.folders.map(workspaceFolder => this.resolveWorkspaceFolderExtensionConfig(workspaceFolder)))) {
			for (const resource of folderExtensionsConfig.resources) {
				resources.set(resource, resource);
			}
			activeDiagnosticOwners.add(this.updateInheritanceDiagnostics(folderExtensionsConfig.configurationResource, folderExtensionsConfig.diagnostics));
			result.push(folderExtensionsConfig.content);
		}
		this.clearStaleInheritanceDiagnostics(activeDiagnosticOwners);
		this.updateWatchedResources([...resources.values()]);
		return result;
	}

	async getRecommendations(): Promise<string[]> {
		const configs = await this.getExtensionsConfigs();
		return distinct(configs.flatMap(c => c.recommendations ? c.recommendations.map(c => c.toLowerCase()) : []));
	}

	async getUnwantedRecommendations(): Promise<string[]> {
		const configs = await this.getExtensionsConfigs();
		return distinct(configs.flatMap(c => c.unwantedRecommendations ? c.unwantedRecommendations.map(c => c.toLowerCase()) : []));
	}

	async toggleRecommendation(extensionId: string): Promise<void> {
		extensionId = extensionId.toLowerCase();
		const workspace = this.workspaceContextService.getWorkspace();
		const workspaceExtensionsConfigContent = workspace.configuration ? (await this.resolveWorkspaceExtensionConfig(workspace.configuration)).content : undefined;
		const workspaceFolderExtensionsConfigContents = new ResourceMap<IExtensionsConfigContent>();
		await Promise.all(workspace.folders.map(async workspaceFolder => {
			const extensionsConfigContent = (await this.resolveWorkspaceFolderExtensionConfig(workspaceFolder)).content;
			workspaceFolderExtensionsConfigContents.set(workspaceFolder.uri, extensionsConfigContent);
		}));

		const isWorkspaceRecommended = workspaceExtensionsConfigContent && workspaceExtensionsConfigContent.recommendations?.some(r => r.toLowerCase() === extensionId);
		const recommendedWorksapceFolders = workspace.folders.filter(workspaceFolder => workspaceFolderExtensionsConfigContents.get(workspaceFolder.uri)?.recommendations?.some(r => r.toLowerCase() === extensionId));
		const isRecommended = isWorkspaceRecommended || recommendedWorksapceFolders.length > 0;

		const workspaceOrFolders = isRecommended
			? await this.pickWorkspaceOrFolders(recommendedWorksapceFolders, isWorkspaceRecommended ? workspace : undefined, localize('select for remove', "Remove extension recommendation from"))
			: await this.pickWorkspaceOrFolders(workspace.folders, workspace.configuration ? workspace : undefined, localize('select for add', "Add extension recommendation to"));

		for (const workspaceOrWorkspaceFolder of workspaceOrFolders) {
			if (isWorkspace(workspaceOrWorkspaceFolder)) {
				await this.addOrRemoveWorkspaceRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceExtensionsConfigContent, !isRecommended);
			} else {
				await this.addOrRemoveWorkspaceFolderRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceFolderExtensionsConfigContents.get(workspaceOrWorkspaceFolder.uri)!, !isRecommended);
			}
		}
	}

	async toggleUnwantedRecommendation(extensionId: string): Promise<void> {
		const workspace = this.workspaceContextService.getWorkspace();
		const workspaceExtensionsConfigContent = workspace.configuration ? (await this.resolveWorkspaceExtensionConfig(workspace.configuration)).content : undefined;
		const workspaceFolderExtensionsConfigContents = new ResourceMap<IExtensionsConfigContent>();
		await Promise.all(workspace.folders.map(async workspaceFolder => {
			const extensionsConfigContent = (await this.resolveWorkspaceFolderExtensionConfig(workspaceFolder)).content;
			workspaceFolderExtensionsConfigContents.set(workspaceFolder.uri, extensionsConfigContent);
		}));

		const isWorkspaceUnwanted = workspaceExtensionsConfigContent && workspaceExtensionsConfigContent.unwantedRecommendations?.some(r => r === extensionId);
		const unWantedWorksapceFolders = workspace.folders.filter(workspaceFolder => workspaceFolderExtensionsConfigContents.get(workspaceFolder.uri)?.unwantedRecommendations?.some(r => r === extensionId));
		const isUnwanted = isWorkspaceUnwanted || unWantedWorksapceFolders.length > 0;

		const workspaceOrFolders = isUnwanted
			? await this.pickWorkspaceOrFolders(unWantedWorksapceFolders, isWorkspaceUnwanted ? workspace : undefined, localize('select for remove', "Remove extension recommendation from"))
			: await this.pickWorkspaceOrFolders(workspace.folders, workspace.configuration ? workspace : undefined, localize('select for add', "Add extension recommendation to"));

		for (const workspaceOrWorkspaceFolder of workspaceOrFolders) {
			if (isWorkspace(workspaceOrWorkspaceFolder)) {
				await this.addOrRemoveWorkspaceUnwantedRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceExtensionsConfigContent, !isUnwanted);
			} else {
				await this.addOrRemoveWorkspaceFolderUnwantedRecommendation(extensionId, workspaceOrWorkspaceFolder, workspaceFolderExtensionsConfigContents.get(workspaceOrWorkspaceFolder.uri)!, !isUnwanted);
			}
		}
	}

	private async addOrRemoveWorkspaceFolderRecommendation(extensionId: string, workspaceFolder: IWorkspaceFolder, extensionsConfigContent: IExtensionsConfigContent, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		if (add) {
			if (Array.isArray(extensionsConfigContent.recommendations)) {
				values.push({ path: ['recommendations', -1], value: extensionId });
			} else {
				values.push({ path: ['recommendations'], value: [extensionId] });
			}
			const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(['unwantedRecommendations'], extensionsConfigContent.unwantedRecommendations, extensionId);
			if (unwantedRecommendationEdit) {
				values.push(unwantedRecommendationEdit);
			}
		} else if (extensionsConfigContent.recommendations) {
			const recommendationEdit = this.getEditToRemoveValueFromArray(['recommendations'], extensionsConfigContent.recommendations, extensionId);
			if (recommendationEdit) {
				values.push(recommendationEdit);
			}
		}

		if (values.length) {
			return this.jsonEditingService.write(workspaceFolder.toResource(EXTENSIONS_CONFIG), values, true);
		}
	}

	private async addOrRemoveWorkspaceRecommendation(extensionId: string, workspace: IWorkspace, extensionsConfigContent: IExtensionsConfigContent | undefined, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		if (extensionsConfigContent) {
			if (add) {
				const path: JSONPath = ['extensions', 'recommendations'];
				if (Array.isArray(extensionsConfigContent.recommendations)) {
					values.push({ path: [...path, -1], value: extensionId });
				} else {
					values.push({ path, value: [extensionId] });
				}
				const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(['extensions', 'unwantedRecommendations'], extensionsConfigContent.unwantedRecommendations, extensionId);
				if (unwantedRecommendationEdit) {
					values.push(unwantedRecommendationEdit);
				}
			} else if (extensionsConfigContent.recommendations) {
				const recommendationEdit = this.getEditToRemoveValueFromArray(['extensions', 'recommendations'], extensionsConfigContent.recommendations, extensionId);
				if (recommendationEdit) {
					values.push(recommendationEdit);
				}
			}
		} else if (add) {
			values.push({ path: ['extensions'], value: { recommendations: [extensionId] } });
		}

		if (values.length) {
			return this.jsonEditingService.write(workspace.configuration!, values, true);
		}
	}

	private async addOrRemoveWorkspaceFolderUnwantedRecommendation(extensionId: string, workspaceFolder: IWorkspaceFolder, extensionsConfigContent: IExtensionsConfigContent, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		if (add) {
			const path: JSONPath = ['unwantedRecommendations'];
			if (Array.isArray(extensionsConfigContent.unwantedRecommendations)) {
				values.push({ path: [...path, -1], value: extensionId });
			} else {
				values.push({ path, value: [extensionId] });
			}
			const recommendationEdit = this.getEditToRemoveValueFromArray(['recommendations'], extensionsConfigContent.recommendations, extensionId);
			if (recommendationEdit) {
				values.push(recommendationEdit);
			}
		} else if (extensionsConfigContent.unwantedRecommendations) {
			const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(['unwantedRecommendations'], extensionsConfigContent.unwantedRecommendations, extensionId);
			if (unwantedRecommendationEdit) {
				values.push(unwantedRecommendationEdit);
			}
		}
		if (values.length) {
			return this.jsonEditingService.write(workspaceFolder.toResource(EXTENSIONS_CONFIG), values, true);
		}
	}

	private async addOrRemoveWorkspaceUnwantedRecommendation(extensionId: string, workspace: IWorkspace, extensionsConfigContent: IExtensionsConfigContent | undefined, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		if (extensionsConfigContent) {
			if (add) {
				const path: JSONPath = ['extensions', 'unwantedRecommendations'];
				if (Array.isArray(extensionsConfigContent.recommendations)) {
					values.push({ path: [...path, -1], value: extensionId });
				} else {
					values.push({ path, value: [extensionId] });
				}
				const recommendationEdit = this.getEditToRemoveValueFromArray(['extensions', 'recommendations'], extensionsConfigContent.recommendations, extensionId);
				if (recommendationEdit) {
					values.push(recommendationEdit);
				}
			} else if (extensionsConfigContent.unwantedRecommendations) {
				const unwantedRecommendationEdit = this.getEditToRemoveValueFromArray(['extensions', 'unwantedRecommendations'], extensionsConfigContent.unwantedRecommendations, extensionId);
				if (unwantedRecommendationEdit) {
					values.push(unwantedRecommendationEdit);
				}
			}
		} else if (add) {
			values.push({ path: ['extensions'], value: { unwantedRecommendations: [extensionId] } });
		}

		if (values.length) {
			return this.jsonEditingService.write(workspace.configuration!, values, true);
		}
	}

	private async pickWorkspaceOrFolders(workspaceFolders: IWorkspaceFolder[], workspace: IWorkspace | undefined, placeHolder: string): Promise<(IWorkspace | IWorkspaceFolder)[]> {
		const workspaceOrFolders = workspace ? [...workspaceFolders, workspace] : [...workspaceFolders];
		if (workspaceOrFolders.length === 1) {
			return workspaceOrFolders;
		}

		const folderPicks: (IQuickPickItem & { workspaceOrFolder: IWorkspace | IWorkspaceFolder } | IQuickPickSeparator)[] = workspaceFolders.map(workspaceFolder => {
			return {
				label: workspaceFolder.name,
				description: localize('workspace folder', "Workspace Folder"),
				workspaceOrFolder: workspaceFolder,
				iconClasses: getIconClasses(this.modelService, this.languageService, workspaceFolder.uri, FileKind.ROOT_FOLDER)
			};
		});

		if (workspace) {
			folderPicks.push({ type: 'separator' });
			folderPicks.push({
				label: localize('workspace', "Workspace"),
				workspaceOrFolder: workspace,
			});
		}

		const result = await this.quickInputService.pick(folderPicks, { placeHolder, canPickMany: true }) || [];
		return result.map(r => r.workspaceOrFolder!);
	}

	private async resolveWorkspaceExtensionConfig(workspaceConfigurationResource: URI): Promise<{ content: IExtensionsConfigContent | undefined; resources: URI[]; diagnostics: IResourceMarker[]; configurationResource: URI }> {
		const inheritance = this.createConfigurationInheritance(workspaceConfigurationResource);
		try {
			const content = await this.fileService.readFile(workspaceConfigurationResource);
			const raw = parse(content.value.toString(), [], { allowEmptyContent: true, allowTrailingComma: true });
			if (!isObject(raw)) {
				return { content: undefined, resources: [workspaceConfigurationResource], diagnostics: [], configurationResource: workspaceConfigurationResource };
			}
			const hasExtensions = Object.prototype.hasOwnProperty.call(raw, 'extensions');
			const resolved = await inheritance.resolveRawContent(raw['extensions']);
			return {
				content: hasExtensions || Object.keys(resolved.raw).length ? this.parseExtensionConfig(resolved.raw) : undefined,
				resources: resolved.resources,
				diagnostics: resolved.diagnostics,
				configurationResource: workspaceConfigurationResource,
			};
		} catch (e) { /* Ignore */ }
		return { content: undefined, resources: [workspaceConfigurationResource], diagnostics: [], configurationResource: workspaceConfigurationResource };
	}

	private async resolveWorkspaceFolderExtensionConfig(workspaceFolder: IWorkspaceFolder): Promise<{ content: IExtensionsConfigContent; resources: URI[]; diagnostics: IResourceMarker[]; configurationResource: URI }> {
		const resource = workspaceFolder.toResource(EXTENSIONS_CONFIG);
		const inheritance = this.createConfigurationInheritance(resource);
		try {
			const content = await this.fileService.readFile(resource);
			const resolved = await inheritance.resolveContent(content.value.toString());
			return { content: this.parseExtensionConfig(resolved.raw), resources: resolved.resources, diagnostics: resolved.diagnostics, configurationResource: resource };
		} catch (e) { /* ignore */ }
		const resolved = await inheritance.resolveContent(undefined);
		return { content: {}, resources: resolved.resources, diagnostics: resolved.diagnostics, configurationResource: resource };
	}

	private parseExtensionConfig(extensionsConfigContent: IExtensionsConfigContent): IExtensionsConfigContent {
		return {
			recommendations: distinct((extensionsConfigContent.recommendations || []).map(e => e.toLowerCase())),
			unwantedRecommendations: distinct((extensionsConfigContent.unwantedRecommendations || []).map(e => e.toLowerCase()))
		};
	}

	private createConfigurationInheritance(resource: URI): ConfigurationFileInheritance {
		return new ConfigurationFileInheritance(resource, this.fileService, this.uriIdentityService, this.logService);
	}

	private updateInheritanceDiagnostics(resource: URI, diagnostics: IResourceMarker[]): string {
		const owner = this.getInheritanceDiagnosticsOwner(resource);
		this.inheritanceDiagnostics.set(owner, diagnostics);
		this.markerService.changeAll(owner, diagnostics);
		return owner;
	}

	private clearStaleInheritanceDiagnostics(activeOwners: Set<string>): void {
		for (const owner of [...this.inheritanceDiagnostics.keys()]) {
			if (!activeOwners.has(owner)) {
				this.markerService.changeAll(owner, []);
				this.inheritanceDiagnostics.delete(owner);
			}
		}
	}

	private clearInheritanceDiagnostics(): void {
		for (const owner of this.inheritanceDiagnostics.keys()) {
			this.markerService.changeAll(owner, []);
		}
		this.inheritanceDiagnostics.clear();
	}

	private getInheritanceDiagnosticsOwner(resource: URI): string {
		return `workbench.extensionsConfigurationInheritance:${resource.toString()}`;
	}

	private pruneInheritanceDiagnosticsForCurrentWorkspace(): void {
		const workspace = this.workspaceContextService.getWorkspace();
		const activeOwners = new Set<string>(workspace.folders.map(folder => this.getInheritanceDiagnosticsOwner(folder.toResource(EXTENSIONS_CONFIG))));
		if (workspace.configuration) {
			activeOwners.add(this.getInheritanceDiagnosticsOwner(workspace.configuration));
		}
		this.clearStaleInheritanceDiagnostics(activeOwners);
	}

	private updateWatchedResources(resources: URI[]): void {
		const uniqueResources = new ResourceMap<URI>();
		for (const resource of resources) {
			uniqueResources.set(resource, resource);
		}
		this.extensionsConfigurationResources = [...uniqueResources.values()];
		this.watchedResources.value = combinedDisposable(...this.extensionsConfigurationResources.map(resource => combinedDisposable(
			this.fileService.watch(this.uriIdentityService.extUri.dirname(resource)),
			this.fileService.watch(resource)
		)));
	}

	private handleFileChangesEvent(event: FileChangesEvent): boolean {
		if (this.extensionsConfigurationResources.some(resource => event.contains(resource))) {
			return true;
		}
		if (this.extensionsConfigurationResources.some(resource => event.contains(this.uriIdentityService.extUri.dirname(resource), FileChangeType.DELETED))) {
			return true;
		}
		return false;
	}

	private handleFileOperationEvent(event: FileOperationEvent): boolean {
		if ((event.isOperation(FileOperation.CREATE) || event.isOperation(FileOperation.COPY) || event.isOperation(FileOperation.DELETE) || event.isOperation(FileOperation.WRITE))
			&& this.extensionsConfigurationResources.some(resource => this.uriIdentityService.extUri.isEqual(event.resource, resource))) {
			return true;
		}
		if (event.isOperation(FileOperation.DELETE)
			&& this.extensionsConfigurationResources.some(resource => this.uriIdentityService.extUri.isEqual(event.resource, this.uriIdentityService.extUri.dirname(resource)))) {
			return true;
		}
		return false;
	}

	private getEditToRemoveValueFromArray(path: JSONPath, array: string[] | undefined, value: string): IJSONValue | undefined {
		const index = array?.indexOf(value);
		if (index !== undefined && index !== -1) {
			return { path: [...path, index], value: undefined };
		}
		return undefined;
	}

}

registerSingleton(IWorkspaceExtensionsConfigService, WorkspaceExtensionsConfigService, InstantiationType.Delayed);
