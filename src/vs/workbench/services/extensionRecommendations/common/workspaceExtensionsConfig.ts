/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { distinct } from '../../../../base/common/arrays.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { parse } from '../../../../base/common/json.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { getIconClasses } from '../../../../editor/common/services/getIconClasses.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { localize } from '../../../../nls.js';
import { FileKind, IFileService } from '../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService, IWorkspaceFolder } from '../../../../platform/workspace/common/workspace.js';
import { getWorkspaceLocalConfigPath } from '../../configuration/common/configuration.js';
import { IJSONEditingService, IJSONValue } from '../../configuration/common/jsonEditing.js';
import { EXTENSIONS_CONFIGURATION_KEY, getLocalWorkspaceFileSectionDescriptor, getWorkspaceFileSectionDescriptor } from '../../configuration/common/workspaceFileConfiguration.js';

const extensionsConfigurationDescriptor = getWorkspaceFileSectionDescriptor(EXTENSIONS_CONFIGURATION_KEY)!;
const localExtensionsConfigurationDescriptor = getLocalWorkspaceFileSectionDescriptor(EXTENSIONS_CONFIGURATION_KEY)!;
const workspaceExtensionsJsonPathPrefix = [extensionsConfigurationDescriptor.workspaceSection];

export const EXTENSIONS_CONFIG = extensionsConfigurationDescriptor.folderSharedPath;
export const EXTENSIONS_LOCAL_CONFIG = localExtensionsConfigurationDescriptor.folderLocalPath;

interface IExtensionsTargetDescriptor {
	readonly kind: 'workspaceFolder' | 'workspaceFolderLocal';
	readonly relativePath: string;
}

const WORKSPACE_FOLDER_EXTENSION_TARGETS: readonly IExtensionsTargetDescriptor[] = [
	{ kind: 'workspaceFolder', relativePath: EXTENSIONS_CONFIG },
	{ kind: 'workspaceFolderLocal', relativePath: EXTENSIONS_LOCAL_CONFIG },
];

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
		this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this._onDidChangeExtensionsConfigs.fire()));
		this._register(this.fileService.onDidFilesChange(e => {
			const workspace = this.workspaceContextService.getWorkspace();
			if ((workspace.configuration && (e.affects(workspace.configuration) || e.affects(getWorkspaceLocalConfigPath(workspace.configuration))))
				|| workspace.folders.some(folder => e.affects(folder.toResource(EXTENSIONS_CONFIG)) || e.affects(folder.toResource(EXTENSIONS_LOCAL_CONFIG)))) {
				this._onDidChangeExtensionsConfigs.fire();
			}
		}));
	}

	async getExtensionsConfigs(): Promise<IExtensionsConfigContent[]> {
		return (await this.getExtensionConfigTargets(false)).map(target => target.content);
	}

	async getRecommendations(): Promise<string[]> {
		const configs = await this.getExtensionsConfigs();
		return distinct(configs.flatMap(config => config.recommendations?.map(recommendation => recommendation.toLowerCase()) ?? []));
	}

	async getUnwantedRecommendations(): Promise<string[]> {
		const configs = await this.getExtensionsConfigs();
		return distinct(configs.flatMap(config => config.unwantedRecommendations?.map(recommendation => recommendation.toLowerCase()) ?? []));
	}

	async toggleRecommendation(extensionId: string): Promise<void> {
		extensionId = extensionId.toLowerCase();
		const targets = await this.getExtensionConfigTargets();
		const configuredTargets = targets.filter(target => target.content.recommendations?.some(recommendation => recommendation.toLowerCase() === extensionId));
		const availableTargets = configuredTargets.length ? configuredTargets : targets;
		const pickedTargets = await this.pickTargets(
			availableTargets,
			configuredTargets.length ? localize('selectRecommendationRemove', "Remove extension recommendation from") : localize('selectRecommendationAdd', "Add extension recommendation to")
		);

		for (const target of pickedTargets) {
			await this.updateRecommendation(target, extensionId, !configuredTargets.length);
		}
	}

	async toggleUnwantedRecommendation(extensionId: string): Promise<void> {
		extensionId = extensionId.toLowerCase();
		const targets = await this.getExtensionConfigTargets();
		const configuredTargets = targets.filter(target => target.content.unwantedRecommendations?.some(recommendation => recommendation === extensionId));
		const availableTargets = configuredTargets.length ? configuredTargets : targets;
		const pickedTargets = await this.pickTargets(
			availableTargets,
			configuredTargets.length ? localize('selectUnwantedRemove', "Remove extension recommendation from") : localize('selectUnwantedAdd', "Add extension recommendation to")
		);

		for (const target of pickedTargets) {
			await this.updateUnwantedRecommendation(target, extensionId, !configuredTargets.length);
		}
	}

	private async getExtensionConfigTargets(includeEmpty = true): Promise<IExtensionsConfigTarget[]> {
		const workspace = this.workspaceContextService.getWorkspace();
		const result: IExtensionsConfigTarget[] = [];
		if (workspace.configuration) {
			const workspaceContent = await this.resolveWorkspaceExtensionConfig(workspace.configuration);
			this.addTarget(result, includeEmpty, {
				kind: 'workspace',
				resource: workspace.configuration,
				jsonPathPrefix: workspaceExtensionsJsonPathPrefix,
			}, workspaceContent);

			const workspaceLocalResource = getWorkspaceLocalConfigPath(workspace.configuration);
			const workspaceLocalContent = await this.resolveWorkspaceExtensionConfig(workspaceLocalResource);
			this.addTarget(result, includeEmpty, {
				kind: 'workspaceLocal',
				resource: workspaceLocalResource,
				jsonPathPrefix: workspaceExtensionsJsonPathPrefix,
			}, workspaceLocalContent);
		}

		for (const workspaceFolder of workspace.folders) {
			for (const targetDescriptor of WORKSPACE_FOLDER_EXTENSION_TARGETS) {
				const content = await this.resolveWorkspaceFolderExtensionConfig(workspaceFolder, targetDescriptor.relativePath);
				this.addTarget(result, includeEmpty, {
					kind: targetDescriptor.kind,
					resource: workspaceFolder.toResource(targetDescriptor.relativePath),
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

	private async updateRecommendation(target: IExtensionsConfigTarget, extensionId: string, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		const { content } = target;
		if (add) {
			values.push({ path: [...target.jsonPathPrefix, 'recommendations'], value: [...content.recommendations ?? [], extensionId] });
			if (content.unwantedRecommendations?.some(existing => existing === extensionId)) {
				values.push({ path: [...target.jsonPathPrefix, 'unwantedRecommendations'], value: content.unwantedRecommendations.filter(existing => existing !== extensionId) });
			}
		} else if (content.recommendations) {
			values.push({ path: [...target.jsonPathPrefix, 'recommendations'], value: content.recommendations.filter(existing => existing !== extensionId) });
		}

		if (values.length) {
			await this.jsonEditingService.write(target.resource, values, true);
		}
	}

	private async updateUnwantedRecommendation(target: IExtensionsConfigTarget, extensionId: string, add: boolean): Promise<void> {
		const values: IJSONValue[] = [];
		const { content } = target;
		if (add) {
			values.push({ path: [...target.jsonPathPrefix, 'unwantedRecommendations'], value: [...content.unwantedRecommendations ?? [], extensionId] });
			if (content.recommendations?.some(existing => existing === extensionId)) {
				values.push({ path: [...target.jsonPathPrefix, 'recommendations'], value: content.recommendations.filter(existing => existing !== extensionId) });
			}
		} else if (content.unwantedRecommendations) {
			values.push({ path: [...target.jsonPathPrefix, 'unwantedRecommendations'], value: content.unwantedRecommendations.filter(existing => existing !== extensionId) });
		}

		if (values.length) {
			await this.jsonEditingService.write(target.resource, values, true);
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
					label: target.kind === 'workspace' ? localize('workspaceLabel', "Workspace") : localize('workspaceLocalLabel', "Local Workspace"),
					description: basename(target.resource),
					target,
				});
			} else {
				picks.push({
					label: target.workspaceFolder!.name,
					description: target.kind === 'workspaceFolder' ? localize('workspaceFolderLabel', "Workspace Folder") : localize('workspaceFolderLocalLabel', "Local Folder"),
					target,
					iconClasses: getIconClasses(this.modelService, this.languageService, target.workspaceFolder!.uri, FileKind.ROOT_FOLDER),
				});
			}
		}

		const result = await this.quickInputService.pick(picks, { placeHolder, canPickMany: true }) ?? [];
		return result.map(pick => pick.target!);
	}

	private async resolveWorkspaceExtensionConfig(resource: URI): Promise<IExtensionsConfigContent | undefined> {
		try {
			const content = await this.fileService.readFile(resource);
			const extensionsConfigContent = parse(content.value.toString())[extensionsConfigurationDescriptor.workspaceSection] as IExtensionsConfigContent | undefined;
			return extensionsConfigContent ? this.parseExtensionConfig(extensionsConfigContent) : undefined;
		} catch {
			return undefined;
		}
	}

	private async resolveWorkspaceFolderExtensionConfig(workspaceFolder: IWorkspaceFolder, relativePath: string): Promise<IExtensionsConfigContent | undefined> {
		try {
			const content = await this.fileService.readFile(workspaceFolder.toResource(relativePath));
			return this.parseExtensionConfig(parse(content.value.toString()) as IExtensionsConfigContent);
		} catch {
			return undefined;
		}
	}

	private parseExtensionConfig(extensionsConfigContent: IExtensionsConfigContent): IExtensionsConfigContent {
		return {
			recommendations: distinct((extensionsConfigContent.recommendations ?? []).map(recommendation => recommendation.toLowerCase())),
			unwantedRecommendations: distinct((extensionsConfigContent.unwantedRecommendations ?? []).map(recommendation => recommendation.toLowerCase())),
		};
	}
}

registerSingleton(IWorkspaceExtensionsConfigService, WorkspaceExtensionsConfigService, InstantiationType.Delayed);
