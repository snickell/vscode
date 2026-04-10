/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const FOLDER_CONFIG_FOLDER_NAME = '.vscode';
export const FOLDER_SETTINGS_NAME = 'settings';
export const FOLDER_SETTINGS_PATH = `${FOLDER_CONFIG_FOLDER_NAME}/${FOLDER_SETTINGS_NAME}.json`;
export const FOLDER_LOCAL_SETTINGS_NAME = 'settings.local';
export const FOLDER_LOCAL_SETTINGS_PATH = `${FOLDER_CONFIG_FOLDER_NAME}/${FOLDER_LOCAL_SETTINGS_NAME}.json`;

export const defaultSettingsSchemaId = 'vscode://schemas/settings/default';
export const userSettingsSchemaId = 'vscode://schemas/settings/user';
export const profileSettingsSchemaId = 'vscode://schemas/settings/profile';
export const machineSettingsSchemaId = 'vscode://schemas/settings/machine';
export const workspaceSettingsSchemaId = 'vscode://schemas/settings/workspace';
export const folderSettingsSchemaId = 'vscode://schemas/settings/folder';
export const launchSchemaId = 'vscode://schemas/launch';
export const tasksSchemaId = 'vscode://schemas/tasks';

export const SETTINGS_CONFIGURATION_KEY = 'settings';
export const TASKS_CONFIGURATION_KEY = 'tasks';
export const LAUNCH_CONFIGURATION_KEY = 'launch';
export const EXTENSIONS_CONFIGURATION_KEY = 'extensions';

export const TASKS_DEFAULT = '{\n\t\"version\": \"2.0.0\",\n\t\"tasks\": []\n}';

export type WorkspaceFileConfigurationKey =
	| typeof SETTINGS_CONFIGURATION_KEY
	| typeof TASKS_CONFIGURATION_KEY
	| typeof LAUNCH_CONFIGURATION_KEY
	| typeof EXTENSIONS_CONFIGURATION_KEY;

export type WorkspaceFileConfigurationFolderType = 'settings' | 'standalone';

export interface IWorkspaceFileConfigurationDescriptor {
	readonly key: WorkspaceFileConfigurationKey;
	readonly workspaceSection: WorkspaceFileConfigurationKey;
	readonly folderSharedPath: string;
	readonly folderLocalPath: string;
	readonly folderType: WorkspaceFileConfigurationFolderType;
	readonly schemaId?: string;
	readonly contributesToConfigurationModel: boolean;
	readonly contributesToExtensionRecommendations: boolean;
	readonly contributesToConfigurationEditing: boolean;
	readonly userStandalonePath?: string;
	readonly defaultContent: string;
}

export const WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS: readonly IWorkspaceFileConfigurationDescriptor[] = [
	{
		key: SETTINGS_CONFIGURATION_KEY,
		workspaceSection: SETTINGS_CONFIGURATION_KEY,
		folderSharedPath: FOLDER_SETTINGS_PATH,
		folderLocalPath: FOLDER_LOCAL_SETTINGS_PATH,
		folderType: 'settings',
		schemaId: folderSettingsSchemaId,
		contributesToConfigurationModel: true,
		contributesToExtensionRecommendations: false,
		contributesToConfigurationEditing: true,
		defaultContent: '{}',
	},
	{
		key: TASKS_CONFIGURATION_KEY,
		workspaceSection: TASKS_CONFIGURATION_KEY,
		folderSharedPath: `${FOLDER_CONFIG_FOLDER_NAME}/${TASKS_CONFIGURATION_KEY}.json`,
		folderLocalPath: `${FOLDER_CONFIG_FOLDER_NAME}/${TASKS_CONFIGURATION_KEY}.local.json`,
		folderType: 'standalone',
		schemaId: tasksSchemaId,
		contributesToConfigurationModel: true,
		contributesToExtensionRecommendations: false,
		contributesToConfigurationEditing: true,
		userStandalonePath: `${TASKS_CONFIGURATION_KEY}.json`,
		defaultContent: TASKS_DEFAULT,
	},
	{
		key: LAUNCH_CONFIGURATION_KEY,
		workspaceSection: LAUNCH_CONFIGURATION_KEY,
		folderSharedPath: `${FOLDER_CONFIG_FOLDER_NAME}/${LAUNCH_CONFIGURATION_KEY}.json`,
		folderLocalPath: `${FOLDER_CONFIG_FOLDER_NAME}/${LAUNCH_CONFIGURATION_KEY}.local.json`,
		folderType: 'standalone',
		schemaId: launchSchemaId,
		contributesToConfigurationModel: true,
		contributesToExtensionRecommendations: false,
		contributesToConfigurationEditing: true,
		defaultContent: '{}',
	},
	{
		key: EXTENSIONS_CONFIGURATION_KEY,
		workspaceSection: EXTENSIONS_CONFIGURATION_KEY,
		folderSharedPath: `${FOLDER_CONFIG_FOLDER_NAME}/${EXTENSIONS_CONFIGURATION_KEY}.json`,
		folderLocalPath: `${FOLDER_CONFIG_FOLDER_NAME}/${EXTENSIONS_CONFIGURATION_KEY}.local.json`,
		folderType: 'standalone',
		contributesToConfigurationModel: true,
		contributesToExtensionRecommendations: true,
		contributesToConfigurationEditing: true,
		defaultContent: '{}',
	},
] as const;

export const WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS = WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.filter(descriptor => descriptor.folderType === 'standalone' && descriptor.contributesToConfigurationModel);
export const USER_STANDALONE_CONFIGURATION_DESCRIPTORS = WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.filter(descriptor => !!descriptor.userStandalonePath && descriptor.contributesToConfigurationEditing);
export const WORKSPACE_STANDALONE_CONFIGURATION_KEYS = WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS.map(descriptor => descriptor.key);

function toConfigurationPathMap(descriptors: readonly IWorkspaceFileConfigurationDescriptor[], pathKey: 'folderSharedPath' | 'folderLocalPath' | 'userStandalonePath'): Record<string, string> {
	const result: Record<string, string> = Object.create(null);
	for (const descriptor of descriptors) {
		const path = descriptor[pathKey];
		if (path) {
			result[descriptor.key] = path;
		}
	}
	return result;
}

export const WORKSPACE_STANDALONE_CONFIGURATIONS = toConfigurationPathMap(WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS, 'folderSharedPath');
export const FOLDER_LOCAL_STANDALONE_CONFIGURATIONS = toConfigurationPathMap(WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS, 'folderLocalPath');
export const USER_STANDALONE_CONFIGURATIONS = toConfigurationPathMap(USER_STANDALONE_CONFIGURATION_DESCRIPTORS, 'userStandalonePath');

export function getWorkspaceFileConfigurationDescriptor(key: string): IWorkspaceFileConfigurationDescriptor | undefined {
	return WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.find(descriptor => descriptor.key === key);
}

export function getWorkspaceExtensionRecommendationDescriptor(): IWorkspaceFileConfigurationDescriptor {
	return WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.find(descriptor => descriptor.contributesToExtensionRecommendations)!;
}
