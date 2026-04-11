/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename, dirname, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { Event } from '../../../../base/common/event.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IAnyWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';

export {
	EXTENSIONS_CONFIGURATION_KEY,
	FOLDER_CONFIG_FOLDER_NAME,
	FOLDER_LOCAL_SETTINGS_NAME,
	FOLDER_LOCAL_SETTINGS_PATH,
	FOLDER_SETTINGS_NAME,
	FOLDER_SETTINGS_PATH,
	LAUNCH_CONFIGURATION_KEY,
	LOCAL_WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS,
	LOCAL_WORKSPACE_FILE_SECTION_DESCRIPTORS,
	LOCAL_WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS,
	LOCAL_WORKSPACE_STANDALONE_SECTION_DESCRIPTORS,
	LOCAL_WORKSPACE_STANDALONE_CONFIGURATION_KEYS,
	MCP_CONFIGURATION_KEY,
	SETTINGS_CONFIGURATION_KEY,
	TASKS_CONFIGURATION_KEY,
	TASKS_DEFAULT,
	WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS,
	WORKSPACE_FILE_SECTION_DESCRIPTORS,
	WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS,
	WORKSPACE_STANDALONE_SECTION_DESCRIPTORS,
	WORKSPACE_STANDALONE_CONFIGURATIONS,
	USER_STANDALONE_CONFIGURATION_DESCRIPTORS,
	USER_STANDALONE_CONFIGURATIONS,
	FOLDER_LOCAL_STANDALONE_CONFIGURATIONS,
	defaultSettingsSchemaId,
	folderSettingsSchemaId,
	getLocalWorkspaceFileConfigurationDescriptor,
	getLocalWorkspaceFileSectionDescriptor,
	getWorkspaceFileConfigurationDescriptor,
	getWorkspaceFileSectionDescriptor,
	launchSchemaId,
	profileSettingsSchemaId,
	tasksSchemaId,
	userSettingsSchemaId,
	workspaceSettingsSchemaId,
	machineSettingsSchemaId,
} from './workspaceFileConfiguration.js';
export const mcpSchemaId = 'vscode://schemas/mcp';

export const APPLICATION_SCOPES = [ConfigurationScope.APPLICATION, ConfigurationScope.APPLICATION_MACHINE];
export const PROFILE_SCOPES = [ConfigurationScope.MACHINE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const LOCAL_MACHINE_PROFILE_SCOPES = [ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE];
export const LOCAL_MACHINE_SCOPES = [ConfigurationScope.APPLICATION, ...LOCAL_MACHINE_PROFILE_SCOPES];
export const REMOTE_MACHINE_SCOPES = [ConfigurationScope.MACHINE, ConfigurationScope.APPLICATION_MACHINE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const WORKSPACE_SCOPES = [ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const FOLDER_SCOPES = [ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];

export type ConfigurationKey = { type: 'defaults' | 'user' | 'workspaces' | 'folder'; key: string };

export interface IConfigurationCache {

	needsCaching(resource: URI): boolean;
	read(key: ConfigurationKey): Promise<string>;
	write(key: ConfigurationKey, content: string): Promise<void>;
	remove(key: ConfigurationKey): Promise<void>;

}

export type RestrictedSettings = {
	default: ReadonlyArray<string>;
	application?: ReadonlyArray<string>;
	userLocal?: ReadonlyArray<string>;
	userRemote?: ReadonlyArray<string>;
	workspace?: ReadonlyArray<string>;
	workspaceFolder?: ResourceMap<ReadonlyArray<string>>;
};

export const IWorkbenchConfigurationService = refineServiceDecorator<IConfigurationService, IWorkbenchConfigurationService>(IConfigurationService);
export interface IWorkbenchConfigurationService extends IConfigurationService {
	readonly restrictedSettings: RestrictedSettings;
	readonly onDidChangeRestrictedSettings: Event<RestrictedSettings>;
	whenRemoteConfigurationLoaded(): Promise<void>;
	initialize(arg: IAnyWorkspaceIdentifier): Promise<void>;
	isSettingAppliedForAllProfiles(setting: string): boolean;
}

export function getWorkspaceLocalConfigPath(workspaceConfigPath: URI): URI {
	return joinPath(dirname(workspaceConfigPath), `${basename(workspaceConfigPath)}.local`);
}

export const APPLY_ALL_PROFILES_SETTING = 'workbench.settings.applyToAllProfiles';
