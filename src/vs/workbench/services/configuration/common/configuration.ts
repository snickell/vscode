/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { refineServiceDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import { ResourceMap } from 'vs/base/common/map';
import { basename, dirname, joinPath } from 'vs/base/common/resources';
import { IAnyWorkspaceIdentifier } from 'vs/platform/workspace/common/workspace';
export {
	defaultSettingsSchemaId,
	userSettingsSchemaId,
	profileSettingsSchemaId,
	machineSettingsSchemaId,
	workspaceSettingsSchemaId,
	folderSettingsSchemaId,
	launchSchemaId,
	tasksSchemaId,
	FOLDER_CONFIG_FOLDER_NAME,
	FOLDER_SETTINGS_NAME,
	FOLDER_SETTINGS_PATH,
	FOLDER_LOCAL_SETTINGS_NAME,
	FOLDER_LOCAL_SETTINGS_PATH,
	SETTINGS_CONFIGURATION_KEY,
	TASKS_CONFIGURATION_KEY,
	LAUNCH_CONFIGURATION_KEY,
	EXTENSIONS_CONFIGURATION_KEY,
	TASKS_DEFAULT,
	WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS,
	WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS,
	USER_STANDALONE_CONFIGURATION_DESCRIPTORS,
	WORKSPACE_STANDALONE_CONFIGURATIONS,
	FOLDER_LOCAL_STANDALONE_CONFIGURATIONS,
	WORKSPACE_STANDALONE_CONFIGURATION_KEYS,
	USER_STANDALONE_CONFIGURATIONS,
} from 'vs/workbench/services/configuration/common/workspaceFileConfiguration';

export const APPLICATION_SCOPES = [ConfigurationScope.APPLICATION];
export const PROFILE_SCOPES = [ConfigurationScope.MACHINE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const LOCAL_MACHINE_PROFILE_SCOPES = [ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE];
export const LOCAL_MACHINE_SCOPES = [ConfigurationScope.APPLICATION, ...LOCAL_MACHINE_PROFILE_SCOPES];
export const REMOTE_MACHINE_SCOPES = [ConfigurationScope.MACHINE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
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
	/**
	 * Restricted settings defined in each configuration target
	 */
	readonly restrictedSettings: RestrictedSettings;

	/**
	 * Event that triggers when the restricted settings changes
	 */
	readonly onDidChangeRestrictedSettings: Event<RestrictedSettings>;

	/**
	 * A promise that resolves when the remote configuration is loaded in a remote window.
	 * The promise is resolved immediately if the window is not remote.
	 */
	whenRemoteConfigurationLoaded(): Promise<void>;

	/**
	 * Initialize configuration service for the given workspace
	 * @param arg workspace Identifier
	 */
	initialize(arg: IAnyWorkspaceIdentifier): Promise<void>;
}

export function getWorkspaceLocalConfigPath(workspaceConfigPath: URI): URI {
	return joinPath(dirname(workspaceConfigPath), `${basename(workspaceConfigPath)}.local`);
}
