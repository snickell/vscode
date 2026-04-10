/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { distinct, flatten } from 'vs/base/common/arrays';
import { Emitter, Event } from 'vs/base/common/event';
import { parse } from 'vs/base/common/json';
import { Disposable } from 'vs/base/common/lifecycle';
import { getIconClasses } from 'vs/editor/common/services/getIconClasses';
import { FileKind, IFileService } from 'vs/platform/files/common/files';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWorkspaceContextService, IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from 'vs/platform/quickinput/common/quickInput';
import { IModelService } from 'vs/editor/common/services/model';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { localize } from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import { IJSONEditingService, IJSONValue } from 'vs/workbench/services/configuration/common/jsonEditing';
import { basename } from 'vs/base/common/resources';
import { getWorkspaceLocalConfigPath } from 'vs/workbench/services/configuration/common/configuration';
import { EXTENSIONS_CONFIGURATION_KEY, getWorkspaceFileConfigurationDescriptor } from 'vs/workbench/services/configuration/common/workspaceFileConfiguration';

const extensionsConfigurationDescriptor = getWorkspaceFileConfigurationDescriptor(EXTENSIONS_CONFIGURATION_KEY)!;
const workspaceExtensionsJsonPathPrefix = [extensionsConfigurationDescriptor.key];
export const EXTENSIONS_CONFIG = extensionsConfigurationDescriptor.folderSharedPath;
export const EXTENSIONS_LOCAL_CONFIG = extensionsConfigurationDescriptor.folderLocalPath;
const WORKSPACE_FOLDER_EXTENSION_TARGETS = [
	{ kind: 'workspaceFolder' as const, relativePath: extensionsConfigurationDescriptor.folderSharedPath },
	{ kind: 'workspaceFolderLocal' as const, relativePath: extensionsConfigurationDescriptor.folderLocalPath },
];

export interface IExtensionsConfigContent {
	recommendations?: string[];
	unwantedRecommendations?: string[];
}

export const IWorkspaceExtensionsConfigService = createDecorator<IWorkspaceExtensionsConfigService>('IWorkspaceExtensionsConfigService');

export interface IWorkspaceExtensionsConfigService {
	readonly _serviceBrand: undefined;

	onDidChangeExtensionsConfigs: Event<void>;
	getExtensionsConfigs(): Promise<IExtensionsConfigContent[]>;
	getRecommendations(): Promise<string[]>;
	getUnwantedRecommendations(): Promise<string[]>;

	toggleRecommendation(extensionId: string): Promise<void>;
	toggleUnwantedRecommendation(extensionId: string): Promise<void>;
}

interface IExtensionsConfigTarget {
	readonly kind: 'workspace' | 'workspaceLocal' | 'workspaceFolder' | 'workspaceFolderLocal';
	readonly resource: URI;
	readonly jsonPathPrefix: string[];
	readonly content: IExtensionsConfigContent;
	readonly workspaceFolder?: IWorkspaceFolder;
}

export class WorkspaceExtensionsConfigService extends Disposable implements IWorkspaceExtensionsConfigService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeExtensionsConfigs = this._register(new Emitter<void>());
	readonly onDidChangeExtensionsConfigs = this._onDidChangeExtensionsConfigs.event;

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IModelService private readonly modelService: IModelService,
		@ILanguageService private readonly languageService: ILanguageService,
		@IJSONEditingService private readonly jsonEditingService: IJSONEditingService,
	) {
		super();
		this._register(workspaceContextService.onDidChangeWorkspaceFolders(e => this._onDidChangeExtensionsConfigs.fire()));
		this._register(fileService.onDidFilesChange(e => {
			const workspace = workspaceContextService.getWorkspace();
			if ((workspace.configuration && (e.affects(workspace.configuration) || e.affects(getWorkspaceLocalConfigPath(workspace.configuration))))
				|| workspace.folders.some(folder => e.affects(folder.toResource(extensionsConfigurationDescriptor.folderSharedPath)) || e.affects(folder.toResource(extensionsConfigurationDescriptor.folderLocalPath)))
			) {
				this._onDidChangeExtensionsConfigs.fire();
			}
		}));
	}

	async getExtensionsConfigs(): Promise<IExtensionsConfigContent[]> {
		return (await this.getExtensionConfigTargets(false)).map(target => target.content);
	}

	async getRecommendations(): Promise<string[]> {
		const configs = await this.getExtensionsConfigs();
		return distinct(flatten(configs.map(c => c.recommendations ? c.recommendations.map(c => c.toLowerCase()) : [])));
	}

	async getUnwantedRecommendations(): Promise<string[]> {
		const configs = await this.getExtensionsConfigs();
		return distinct(flatten(configs.map(c => c.unwantedRecommendations ? c.unwantedRecommendations.map(c => c.toLowerCase()) : [])));
	}

	async toggleRecommendation(extensionId: string): Promise<void> {
		extensionId = extensionId.toLowerCase();
		const targets = await this.getExtensionConfigTargets();
		const configuredTargets = targets.filter(target => target.content.recommendations?.some(r => r.toLowerCase() === extensionId));
		const availableTargets = configuredTargets.length ? configuredTargets : targets;
		const pickedTargets = await this.pickTargets(
			availableTargets,
			configuredTargets.length ? localize('select for remove', "Remove extension recommendation from") : localize('select for add', "Add extension recommendation to")
		);

		for (const target of pickedTargets) {
			await this.updateRecommendation(target, extensionId, !configuredTargets.length);
		}
	}

	async toggleUnwantedRecommendation(extensionId: string): Promise<void> {
		const targets = await this.getExtensionConfigTargets();
		const configuredTargets = targets.filter(target => target.content.unwantedRecommendations?.some(r => r === extensionId));
		const availableTargets = configuredTargets.length ? configuredTargets : targets;
		const pickedTargets = await this.pickTargets(
			availableTargets,
			configuredTargets.length ? localize('select for remove', "Remove extension recommendation from") : localize('select for add', "Add extension recommendation to")
		);

		for (const target of pickedTargets) {
			await this.updateUnwantedRecommendation(target, extensionId, !configuredTargets.length);
		}
	}

	private async updateRecommendation(target: IExtensionsConfigTarget, extensionId: string, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		const { content } = target;
		if (add) {
			values.push({ path: [...target.jsonPathPrefix, 'recommendations'], value: [...content.recommendations || [], extensionId] });
			if (content.unwantedRecommendations && content.unwantedRecommendations.some(e => e === extensionId)) {
				values.push({ path: [...target.jsonPathPrefix, 'unwantedRecommendations'], value: content.unwantedRecommendations.filter(e => e !== extensionId) });
			}
		} else if (content.recommendations) {
			values.push({ path: [...target.jsonPathPrefix, 'recommendations'], value: content.recommendations.filter(e => e !== extensionId) });
		}

		if (values.length) {
			return this.jsonEditingService.write(target.resource, values, true);
		}
	}

	private async updateUnwantedRecommendation(target: IExtensionsConfigTarget, extensionId: string, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		const { content } = target;
		if (add) {
			values.push({ path: [...target.jsonPathPrefix, 'unwantedRecommendations'], value: [...content.unwantedRecommendations || [], extensionId] });
			if (content.recommendations && content.recommendations.some(e => e === extensionId)) {
				values.push({ path: [...target.jsonPathPrefix, 'recommendations'], value: content.recommendations.filter(e => e !== extensionId) });
			}
		} else if (content.unwantedRecommendations) {
			values.push({ path: [...target.jsonPathPrefix, 'unwantedRecommendations'], value: content.unwantedRecommendations.filter(e => e !== extensionId) });
		}

		if (values.length) {
			return this.jsonEditingService.write(target.resource, values, true);
		}
	}

	private async pickTargets(targets: IExtensionsConfigTarget[], placeHolder: string): Promise<IExtensionsConfigTarget[]> {
		if (targets.length === 1) {
			return targets;
		}

		const picks: (IQuickPickItem & { target: IExtensionsConfigTarget } | IQuickPickSeparator)[] = [];
		for (const target of targets) {
			if (target.kind === 'workspace' || target.kind === 'workspaceLocal') {
				picks.push({
					label: target.kind === 'workspace' ? localize('workspace', "Workspace") : localize('workspaceLocal', "Local Workspace"),
					description: basename(target.resource),
					target,
				});
			} else {
				picks.push({
					label: target.workspaceFolder!.name,
					description: target.kind === 'workspaceFolder' ? localize('workspace folder', "Workspace Folder") : localize('workspace folder local', "Local Folder"),
					target,
					iconClasses: getIconClasses(this.modelService, this.languageService, target.workspaceFolder!.uri, FileKind.ROOT_FOLDER)
				});
			}
		}

		const result = await this.quickInputService.pick(picks, { placeHolder, canPickMany: true }) || [];
		return result.map(r => r.target!);
	}

	private async getExtensionConfigTargets(includeEmpty = true): Promise<IExtensionsConfigTarget[]> {
		const workspace = this.workspaceContextService.getWorkspace();
		const result: IExtensionsConfigTarget[] = [];
		if (workspace.configuration) {
			const workspaceExtensionsConfigContent = await this.resolveWorkspaceExtensionConfig(workspace.configuration);
			this.addTarget(result, includeEmpty, { kind: 'workspace', resource: workspace.configuration, jsonPathPrefix: workspaceExtensionsJsonPathPrefix }, workspaceExtensionsConfigContent);
			const workspaceLocalConfigurationResource = getWorkspaceLocalConfigPath(workspace.configuration);
			const workspaceLocalExtensionsConfigContent = await this.resolveWorkspaceExtensionConfig(workspaceLocalConfigurationResource);
			this.addTarget(result, includeEmpty, { kind: 'workspaceLocal', resource: workspaceLocalConfigurationResource, jsonPathPrefix: workspaceExtensionsJsonPathPrefix }, workspaceLocalExtensionsConfigContent);
		}

		for (const workspaceFolder of workspace.folders) {
			for (const target of WORKSPACE_FOLDER_EXTENSION_TARGETS) {
				const content = await this.resolveWorkspaceFolderExtensionConfig(workspaceFolder, target.relativePath);
				this.addTarget(result, includeEmpty, {
					kind: target.kind,
					resource: workspaceFolder.toResource(target.relativePath),
					jsonPathPrefix: [],
					workspaceFolder,
				}, content);
			}
		}

		return result;
	}

	private addTarget(targets: IExtensionsConfigTarget[], includeEmpty: boolean, target: Omit<IExtensionsConfigTarget, 'content'>, content: IExtensionsConfigContent | undefined): void {
		if (includeEmpty || content) {
			targets.push({ ...target, content: content ?? {} });
		}
	}

	private async resolveWorkspaceExtensionConfig(workspaceConfigurationResource: URI): Promise<IExtensionsConfigContent | undefined> {
		try {
			const content = await this.fileService.readFile(workspaceConfigurationResource);
			const extensionsConfigContent = <IExtensionsConfigContent | undefined>parse(content.value.toString())[extensionsConfigurationDescriptor.key];
			return extensionsConfigContent ? this.parseExtensionConfig(extensionsConfigContent) : undefined;
		} catch (e) { /* Ignore */ }
		return undefined;
	}

	private async resolveWorkspaceFolderExtensionConfig(workspaceFolder: IWorkspaceFolder, relativePath: string): Promise<IExtensionsConfigContent | undefined> {
		try {
			const content = await this.fileService.readFile(workspaceFolder.toResource(relativePath));
			const extensionsConfigContent = <IExtensionsConfigContent>parse(content.value.toString());
			return this.parseExtensionConfig(extensionsConfigContent);
		} catch (e) { /* ignore */ }
		return undefined;
	}

	private parseExtensionConfig(extensionsConfigContent: IExtensionsConfigContent): IExtensionsConfigContent {
		return {
			recommendations: distinct((extensionsConfigContent.recommendations || []).map(e => e.toLowerCase())),
			unwantedRecommendations: distinct((extensionsConfigContent.unwantedRecommendations || []).map(e => e.toLowerCase()))
		};
	}

}

registerSingleton(IWorkspaceExtensionsConfigService, WorkspaceExtensionsConfigService, InstantiationType.Delayed);
