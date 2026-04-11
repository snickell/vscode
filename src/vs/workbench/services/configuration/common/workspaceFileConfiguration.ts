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
export const MCP_CONFIGURATION_KEY = 'mcp';

export const TASKS_DEFAULT = '{\n\t\"version\": \"2.0.0\",\n\t\"tasks\": []\n}';

export type WorkspaceFileConfigurationKey =
	| typeof SETTINGS_CONFIGURATION_KEY
	| typeof TASKS_CONFIGURATION_KEY
	| typeof LAUNCH_CONFIGURATION_KEY
	| typeof EXTENSIONS_CONFIGURATION_KEY
	| typeof MCP_CONFIGURATION_KEY;

type StandaloneWorkspaceFileConfigurationKey = Exclude<WorkspaceFileConfigurationKey, typeof SETTINGS_CONFIGURATION_KEY>;

export type WorkspaceFileConfigurationFolderType = 'settings' | 'standalone';

export interface IWorkspaceFileConfigurationDescriptor {
	readonly key: WorkspaceFileConfigurationKey;
	readonly workspaceSection?: string;
	readonly folderSharedPath: string;
	readonly folderLocalPath?: string;
	readonly folderType: WorkspaceFileConfigurationFolderType;
	readonly userStandalonePath?: string;
}

export type WorkspaceFileSectionDescriptor = IWorkspaceFileConfigurationDescriptor & { readonly workspaceSection: string };
export type LocalWorkspaceFileConfigurationDescriptor = IWorkspaceFileConfigurationDescriptor & { readonly folderLocalPath: string };
export type LocalWorkspaceFileSectionDescriptor = WorkspaceFileSectionDescriptor & LocalWorkspaceFileConfigurationDescriptor;
export type UserStandaloneConfigurationDescriptor = IWorkspaceFileConfigurationDescriptor & { readonly userStandalonePath: string };

function createStandaloneDescriptor(
	key: StandaloneWorkspaceFileConfigurationKey,
	options: { workspaceSection?: string; folderLocalPath?: string; userStandalonePath?: string } = {}
): IWorkspaceFileConfigurationDescriptor {
	return {
		key,
		workspaceSection: options.workspaceSection,
		folderSharedPath: `${FOLDER_CONFIG_FOLDER_NAME}/${key}.json`,
		folderLocalPath: options.folderLocalPath,
		folderType: 'standalone',
		userStandalonePath: options.userStandalonePath,
	};
}

export const WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS: readonly IWorkspaceFileConfigurationDescriptor[] = [
	{
		key: SETTINGS_CONFIGURATION_KEY,
		workspaceSection: SETTINGS_CONFIGURATION_KEY,
		folderSharedPath: FOLDER_SETTINGS_PATH,
		folderLocalPath: FOLDER_LOCAL_SETTINGS_PATH,
		folderType: 'settings',
	},
	createStandaloneDescriptor(TASKS_CONFIGURATION_KEY, {
		workspaceSection: TASKS_CONFIGURATION_KEY,
		folderLocalPath: `${FOLDER_CONFIG_FOLDER_NAME}/${TASKS_CONFIGURATION_KEY}.local.json`,
		userStandalonePath: `${TASKS_CONFIGURATION_KEY}.json`,
	}),
	createStandaloneDescriptor(LAUNCH_CONFIGURATION_KEY, {
		workspaceSection: LAUNCH_CONFIGURATION_KEY,
		folderLocalPath: `${FOLDER_CONFIG_FOLDER_NAME}/${LAUNCH_CONFIGURATION_KEY}.local.json`,
	}),
	createStandaloneDescriptor(EXTENSIONS_CONFIGURATION_KEY, {
		workspaceSection: EXTENSIONS_CONFIGURATION_KEY,
		folderLocalPath: `${FOLDER_CONFIG_FOLDER_NAME}/${EXTENSIONS_CONFIGURATION_KEY}.local.json`,
	}),
	createStandaloneDescriptor(MCP_CONFIGURATION_KEY, {
		userStandalonePath: `${MCP_CONFIGURATION_KEY}.json`,
	}),
] as const;

function hasWorkspaceSection(descriptor: IWorkspaceFileConfigurationDescriptor): descriptor is WorkspaceFileSectionDescriptor {
	return typeof descriptor.workspaceSection === 'string';
}

function hasFolderLocalPath(descriptor: IWorkspaceFileConfigurationDescriptor): descriptor is LocalWorkspaceFileConfigurationDescriptor {
	return typeof descriptor.folderLocalPath === 'string';
}

function hasWorkspaceSectionAndFolderLocalPath(descriptor: IWorkspaceFileConfigurationDescriptor): descriptor is LocalWorkspaceFileSectionDescriptor {
	return hasWorkspaceSection(descriptor) && hasFolderLocalPath(descriptor);
}

function hasUserStandalonePath(descriptor: IWorkspaceFileConfigurationDescriptor): descriptor is UserStandaloneConfigurationDescriptor {
	return typeof descriptor.userStandalonePath === 'string';
}

export const WORKSPACE_FILE_SECTION_DESCRIPTORS = WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.filter(hasWorkspaceSection);
export const LOCAL_WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS = WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.filter(hasFolderLocalPath);
export const LOCAL_WORKSPACE_FILE_SECTION_DESCRIPTORS = WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.filter(hasWorkspaceSectionAndFolderLocalPath);
export const WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS = WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.filter(descriptor => descriptor.folderType === 'standalone');
export const WORKSPACE_STANDALONE_SECTION_DESCRIPTORS = WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS.filter(hasWorkspaceSection);
export const LOCAL_WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS = LOCAL_WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.filter(descriptor => descriptor.folderType === 'standalone');
export const LOCAL_WORKSPACE_STANDALONE_SECTION_DESCRIPTORS = LOCAL_WORKSPACE_FILE_SECTION_DESCRIPTORS.filter(descriptor => descriptor.folderType === 'standalone');
export const USER_STANDALONE_CONFIGURATION_DESCRIPTORS = WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS.filter(hasUserStandalonePath);
export const WORKSPACE_STANDALONE_CONFIGURATION_KEYS = WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS.map(descriptor => descriptor.key);
export const LOCAL_WORKSPACE_STANDALONE_CONFIGURATION_KEYS = LOCAL_WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS.map(descriptor => descriptor.key);

function toConfigurationPathMap(
	descriptors: readonly IWorkspaceFileConfigurationDescriptor[],
	pathKey: 'folderSharedPath' | 'folderLocalPath' | 'userStandalonePath'
): Record<string, string> {
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
export const FOLDER_LOCAL_STANDALONE_CONFIGURATIONS = toConfigurationPathMap(LOCAL_WORKSPACE_STANDALONE_CONFIGURATION_DESCRIPTORS, 'folderLocalPath');
export const USER_STANDALONE_CONFIGURATIONS = toConfigurationPathMap(USER_STANDALONE_CONFIGURATION_DESCRIPTORS, 'userStandalonePath');

export function getWorkspaceFileConfigurationDescriptor(key: string): IWorkspaceFileConfigurationDescriptor | undefined {
	return WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.find(descriptor => descriptor.key === key);
}

export function getWorkspaceFileSectionDescriptor(key: string): WorkspaceFileSectionDescriptor | undefined {
	return WORKSPACE_FILE_SECTION_DESCRIPTORS.find(descriptor => descriptor.key === key);
}

export function getLocalWorkspaceFileConfigurationDescriptor(key: string): LocalWorkspaceFileConfigurationDescriptor | undefined {
	return LOCAL_WORKSPACE_FILE_CONFIGURATION_DESCRIPTORS.find(descriptor => descriptor.key === key);
}

export function getLocalWorkspaceFileSectionDescriptor(key: string): LocalWorkspaceFileSectionDescriptor | undefined {
	return LOCAL_WORKSPACE_FILE_SECTION_DESCRIPTORS.find(descriptor => descriptor.key === key);
}
