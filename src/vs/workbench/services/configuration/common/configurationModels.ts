/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { equals } from 'vs/base/common/objects';
import { toValuesTree, IConfigurationModel, IConfigurationOverrides, IConfigurationValue, IConfigurationChange } from 'vs/platform/configuration/common/configuration';
import { Configuration as BaseConfiguration, ConfigurationModelParser, ConfigurationModel, ConfigurationParseOptions } from 'vs/platform/configuration/common/configurationModels';
import { IStoredWorkspaceFolder } from 'vs/platform/workspaces/common/workspaces';
import { Workspace } from 'vs/platform/workspace/common/workspace';
import { ResourceMap } from 'vs/base/common/map';
import { URI } from 'vs/base/common/uri';
import { isBoolean } from 'vs/base/common/types';
import { distinct } from 'vs/base/common/arrays';
import { EXTENSIONS_CONFIGURATION_KEY, LAUNCH_CONFIGURATION_KEY, TASKS_CONFIGURATION_KEY, WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS } from 'vs/workbench/services/configuration/common/configuration';

export class WorkspaceConfigurationModelParser extends ConfigurationModelParser {

	private _folders: IStoredWorkspaceFolder[] = [];
	private _transient: boolean = false;
	private _settingsModelParser: ConfigurationModelParser;
	private _standaloneModels = new Map<string, ConfigurationModel>();

	constructor(name: string) {
		super(name);
		this._settingsModelParser = new ConfigurationModelParser(name);
		for (const descriptor of WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS) {
			this._standaloneModels.set(descriptor.key, new ConfigurationModel());
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
		return WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS.map(descriptor => this.getStandaloneModel(descriptor.key));
	}

	reparseWorkspaceSettings(configurationParseOptions: ConfigurationParseOptions): void {
		this._settingsModelParser.reparse(configurationParseOptions);
	}

	getRestrictedWorkspaceSettings(): string[] {
		return this._settingsModelParser.restrictedConfigurations;
	}

	protected override doParseRaw(raw: any, configurationParseOptions?: ConfigurationParseOptions): IConfigurationModel {
		this._folders = (raw['folders'] || []) as IStoredWorkspaceFolder[];
		this._transient = isBoolean(raw['transient']) && raw['transient'];
		this._settingsModelParser.parseRaw(raw['settings'], configurationParseOptions);
		for (const descriptor of WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS) {
			this._standaloneModels.set(descriptor.key, this.createConfigurationModelFrom(raw, descriptor.workspaceSection));
		}
		return super.doParseRaw(raw, configurationParseOptions);
	}

	private getStandaloneModel(key: string): ConfigurationModel {
		return this._standaloneModels.get(key) ?? new ConfigurationModel();
	}

	private createConfigurationModelFrom(raw: any, key: string): ConfigurationModel {
		const data = raw[key];
		if (data) {
			const contents = toValuesTree(data, message => console.error(`Conflict in settings file ${this._name}: ${message}`));
			const scopedContents = Object.create(null);
			scopedContents[key] = contents;
			const keys = Object.keys(data).map(k => `${key}.${k}`);
			return new ConfigurationModel(scopedContents, keys, []);
		}
		return new ConfigurationModel();
	}
}

export class StandaloneConfigurationModelParser extends ConfigurationModelParser {

	constructor(name: string, private readonly scope: string) {
		super(name);
	}

	protected override doParseRaw(raw: any, configurationParseOptions?: ConfigurationParseOptions): IConfigurationModel {
		const contents = toValuesTree(raw, message => console.error(`Conflict in settings file ${this._name}: ${message}`));
		const scopedContents = Object.create(null);
		scopedContents[this.scope] = contents;
		const keys = Object.keys(raw).map(key => `${this.scope}.${key}`);
		return { contents: scopedContents, keys, overrides: [] };
	}

}

export class Configuration extends BaseConfiguration {

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
		private readonly _workspace?: Workspace,
		workspaceLocalConfiguration: ConfigurationModel = new ConfigurationModel(),
		folderLocalConfigurations: ResourceMap<ConfigurationModel> = new ResourceMap<ConfigurationModel>()) {
		super(defaults, policy, application, localUser, remoteUser, workspaceConfiguration, folders, memoryConfiguration, memoryConfigurationByResource, workspaceLocalConfiguration, folderLocalConfigurations);
	}

	override getValue(key: string | undefined, overrides: IConfigurationOverrides = {}): any {
		return super.getValue(key, overrides, this._workspace);
	}

	override inspect<C>(key: string, overrides: IConfigurationOverrides = {}): IConfigurationValue<C> {
		return super.inspect(key, overrides, this._workspace);
	}

	override keys(): {
		default: string[];
		user: string[];
		workspace: string[];
		workspaceFolder: string[];
	} {
		return super.keys(this._workspace);
	}

	override compareAndDeleteFolderConfiguration(folder: URI): IConfigurationChange {
		if (this._workspace && this._workspace.folders.length > 0 && this._workspace.folders[0].uri.toString() === folder.toString()) {
			// Do not remove workspace configuration
			return { keys: [], overrides: [] };
		}
		return super.compareAndDeleteFolderConfiguration(folder);
	}

	override compareAndDeleteFolderLocalConfiguration(folder: URI): IConfigurationChange {
		if (this._workspace && this._workspace.folders.length > 0 && this._workspace.folders[0].uri.toString() === folder.toString()) {
			// Do not remove workspace local configuration
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
				// Ignore if the key does not exist in both models
				if (toKeys.indexOf(key) === -1) {
					return false;
				}
				// Compare workspace value
				if (!equals(this.getValue(key, { overrideIdentifier }), other.getValue(key, { overrideIdentifier }))) {
					return true;
				}
				// Compare workspace folder value
				return this._workspace && this._workspace.folders.some(folder => !equals(this.getValue(key, { resource: folder.uri, overrideIdentifier }), other.getValue(key, { resource: folder.uri, overrideIdentifier })));
			}));
			return keys;
		};
		const keys = compare(this.allKeys(), other.allKeys());
		const overrides: [string, string[]][] = [];
		const allOverrideIdentifiers = distinct([...this.allOverrideIdentifiers(), ...other.allOverrideIdentifiers()]);
		for (const overrideIdentifier of allOverrideIdentifiers) {
			const keys = compare(this.getAllKeysForOverrideIdentifier(overrideIdentifier), other.getAllKeysForOverrideIdentifier(overrideIdentifier), overrideIdentifier);
			if (keys.length) {
				overrides.push([overrideIdentifier, keys]);
			}
		}
		return { keys, overrides };
	}

}
