/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { distinct } from '../../../../base/common/arrays.js';
import { IStringDictionary } from '../../../../base/common/collections.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { equals } from '../../../../base/common/objects.js';
import { URI } from '../../../../base/common/uri.js';
import { isBoolean } from '../../../../base/common/types.js';
import { toValuesTree, IConfigurationChange, IConfigurationModel, IConfigurationOverrides, IConfigurationValue } from '../../../../platform/configuration/common/configuration.js';
import { Configuration as BaseConfiguration, ConfigurationModel, ConfigurationModelParser, ConfigurationParseOptions } from '../../../../platform/configuration/common/configurationModels.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Workspace } from '../../../../platform/workspace/common/workspace.js';
import { IStoredWorkspaceFolder } from '../../../../platform/workspaces/common/workspaces.js';
import { EXTENSIONS_CONFIGURATION_KEY, LAUNCH_CONFIGURATION_KEY, TASKS_CONFIGURATION_KEY } from './configuration.js';
import { type WorkspaceFileSectionDescriptor, WORKSPACE_STANDALONE_SECTION_DESCRIPTORS } from './workspaceFileConfiguration.js';

export class WorkspaceConfigurationModelParser extends ConfigurationModelParser {

	private _folders: IStoredWorkspaceFolder[] = [];
	private _transient = false;
	private readonly _settingsModelParser: ConfigurationModelParser;
	private readonly _standaloneModels = new Map<string, ConfigurationModel>();

	constructor(
		name: string,
		logService: ILogService,
		private readonly standaloneConfigurationDescriptors: readonly WorkspaceFileSectionDescriptor[] = WORKSPACE_STANDALONE_SECTION_DESCRIPTORS
	) {
		super(name, logService);
		this._settingsModelParser = new ConfigurationModelParser(name, logService);
		for (const descriptor of this.standaloneConfigurationDescriptors) {
			this._standaloneModels.set(descriptor.key, ConfigurationModel.createEmptyModel(logService));
		}
	}

	get folders(): IStoredWorkspaceFolder[] {
		return this._folders;
	}

	get transient(): boolean {
		return this._transient;
	}

	get settingsModel(): ConfigurationModel {
		return this._settingsModelParser.configurationModel;
	}

	get launchModel(): ConfigurationModel {
		return this.getStandaloneModel(LAUNCH_CONFIGURATION_KEY);
	}

	get tasksModel(): ConfigurationModel {
		return this.getStandaloneModel(TASKS_CONFIGURATION_KEY);
	}

	get extensionsModel(): ConfigurationModel {
		return this.getStandaloneModel(EXTENSIONS_CONFIGURATION_KEY);
	}

	get standaloneConfigurationModels(): ConfigurationModel[] {
		return this.standaloneConfigurationDescriptors.map(descriptor => this.getStandaloneModel(descriptor.key));
	}

	reparseWorkspaceSettings(configurationParseOptions: ConfigurationParseOptions): void {
		this._settingsModelParser.reparse(configurationParseOptions);
	}

	getRestrictedWorkspaceSettings(): string[] {
		return this._settingsModelParser.restrictedConfigurations;
	}

	protected override doParseRaw(raw: IStringDictionary<unknown>, configurationParseOptions?: ConfigurationParseOptions): IConfigurationModel {
		this._folders = (raw.folders || []) as IStoredWorkspaceFolder[];
		this._transient = isBoolean(raw.transient) && raw.transient;
		this._settingsModelParser.parseRaw(raw.settings as IStringDictionary<unknown>, configurationParseOptions);
		for (const descriptor of this.standaloneConfigurationDescriptors) {
			this._standaloneModels.set(descriptor.key, this.createConfigurationModelFrom(raw, descriptor.workspaceSection));
		}
		return super.doParseRaw(raw, configurationParseOptions);
	}

	private getStandaloneModel(key: string): ConfigurationModel {
		return this._standaloneModels.get(key) ?? ConfigurationModel.createEmptyModel(this.logService);
	}

	private createConfigurationModelFrom(raw: IStringDictionary<unknown>, key: string): ConfigurationModel {
		const data = raw[key] as IStringDictionary<unknown> | undefined;
		if (data) {
			const contents = toValuesTree(data, message => console.error(`Conflict in settings file ${this._name}: ${message}`));
			const scopedContents = Object.create(null);
			scopedContents[key] = contents;
			const keys = Object.keys(data).map(dataKey => `${key}.${dataKey}`);
			return new ConfigurationModel(scopedContents, keys, [], undefined, this.logService);
		}
		return ConfigurationModel.createEmptyModel(this.logService);
	}
}

export class StandaloneConfigurationModelParser extends ConfigurationModelParser {

	constructor(name: string, private readonly scope: string, logService: ILogService) {
		super(name, logService);
	}

	protected override doParseRaw(raw: IStringDictionary<unknown>): IConfigurationModel {
		const contents = toValuesTree(raw, message => console.error(`Conflict in settings file ${this._name}: ${message}`));
		const scopedContents = Object.create(null);
		scopedContents[this.scope] = contents;
		const keys = Object.keys(raw).map(key => `${this.scope}.${key}`);
		return { contents: scopedContents, keys, overrides: [] };
	}
}

export class Configuration extends BaseConfiguration {

	private readonly _workspace: Workspace | undefined;

	constructor(
		defaults: ConfigurationModel,
		policy: ConfigurationModel,
		application: ConfigurationModel,
		localUser: ConfigurationModel,
		remoteUser: ConfigurationModel,
		workspaceConfiguration: ConfigurationModel,
		folders: ResourceMap<ConfigurationModel>,
		memoryConfiguration: ConfigurationModel,
		memoryConfigurationByResource: ResourceMap<ConfigurationModel>,
		workspace: Workspace | undefined,
		workspaceLocalConfiguration: ConfigurationModel,
		folderLocalConfigurations: ResourceMap<ConfigurationModel>,
		logService: ILogService
	) {
		super(defaults, policy, application, localUser, remoteUser, workspaceConfiguration, folders, memoryConfiguration, memoryConfigurationByResource, workspaceLocalConfiguration, folderLocalConfigurations, logService);
		this._workspace = workspace;
	}

	override getValue(key: string | undefined, overrides: IConfigurationOverrides = {}): unknown {
		return super.getValue(key, overrides, this._workspace);
	}

	override inspect<C>(key: string, overrides: IConfigurationOverrides = {}): IConfigurationValue<C> {
		return super.inspect(key, overrides, this._workspace);
	}

	override keys(): { default: string[]; policy: string[]; user: string[]; workspace: string[]; workspaceFolder: string[]; } {
		return super.keys(this._workspace);
	}

	override compareAndDeleteFolderConfiguration(folder: URI): IConfigurationChange {
		if (this._workspace?.folders.length && this._workspace.folders[0].uri.toString() === folder.toString()) {
			return { keys: [], overrides: [] };
		}
		return super.compareAndDeleteFolderConfiguration(folder);
	}

	override compareAndDeleteFolderLocalConfiguration(folder: URI): IConfigurationChange {
		if (this._workspace?.folders.length && this._workspace.folders[0].uri.toString() === folder.toString()) {
			return { keys: [], overrides: [] };
		}
		return super.compareAndDeleteFolderLocalConfiguration(folder);
	}

	compare(other: Configuration): IConfigurationChange {
		const compare = (fromKeys: string[], toKeys: string[], overrideIdentifier?: string): string[] => {
			const keys: string[] = [];
			keys.push(...toKeys.filter(key => fromKeys.indexOf(key) === -1));
			keys.push(...fromKeys.filter(key => toKeys.indexOf(key) === -1));
			keys.push(...fromKeys.filter(key => {
				if (toKeys.indexOf(key) === -1) {
					return false;
				}
				if (!equals(this.getValue(key, { overrideIdentifier }), other.getValue(key, { overrideIdentifier }))) {
					return true;
				}
				return this._workspace ? this._workspace.folders.some(folder => !equals(this.getValue(key, { resource: folder.uri, overrideIdentifier }), other.getValue(key, { resource: folder.uri, overrideIdentifier }))) : false;
			}));
			return keys;
		};
		const keys = compare(this.allKeys(), other.allKeys());
		const overrides: [string, string[]][] = [];
		const allOverrideIdentifiers = distinct([...this.allOverrideIdentifiers(), ...other.allOverrideIdentifiers()]);
		for (const overrideIdentifier of allOverrideIdentifiers) {
			const overrideKeys = compare(this.getAllKeysForOverrideIdentifier(overrideIdentifier), other.getAllKeysForOverrideIdentifier(overrideIdentifier), overrideIdentifier);
			if (overrideKeys.length) {
				overrides.push([overrideIdentifier, overrideKeys]);
			}
		}
		return { keys, overrides };
	}
}
