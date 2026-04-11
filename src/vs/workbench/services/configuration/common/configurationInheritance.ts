/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as errors from '../../../../base/common/errors.js';
import * as json from '../../../../base/common/json.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { deepClone } from '../../../../base/common/objects.js';
import { URI } from '../../../../base/common/uri.js';
import { isObject, isStringArray } from '../../../../base/common/types.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IResourceMarker, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { localize } from '../../../../nls.js';
import { CONFIGURATION_INHERITANCE_KEY } from './configuration.js';

type ConfigurationValue = string | number | boolean | null | ConfigurationValue[] | ConfigurationObject;
interface ConfigurationObject { [key: string]: ConfigurationValue }

export interface IResolvedConfigurationInheritance {
	readonly raw: ConfigurationObject;
	readonly content: string;
	readonly resources: URI[];
	readonly diagnostics: IResourceMarker[];
}

export class ConfigurationFileInheritance {

	private readonly configurationRoot: URI;

	constructor(
		private readonly configurationResource: URI,
		private readonly fileService: IFileService,
		private readonly uriIdentityService: IUriIdentityService,
		private readonly logService: ILogService,
	) {
		this.configurationRoot = this.uriIdentityService.extUri.dirname(configurationResource);
	}

	async resolveContent(content: string | undefined): Promise<IResolvedConfigurationInheritance> {
		const diagnostics = new ResourceMap<IResourceMarker[]>();
		const raw = this.parseConfigurationContent(this.configurationResource, content, false, diagnostics);
		return this.toResolvedConfigurationInheritance(await this.resolveRaw(this.configurationResource, raw, [], diagnostics), diagnostics);
	}

	async resolveRawContent(raw: unknown): Promise<IResolvedConfigurationInheritance> {
		const diagnostics = new ResourceMap<IResourceMarker[]>();
		return this.toResolvedConfigurationInheritance(await this.resolveRaw(this.configurationResource, raw, [], diagnostics), diagnostics);
	}

	private toResolvedConfigurationInheritance(result: { raw: ConfigurationObject; resources: URI[] }, diagnostics: ResourceMap<IResourceMarker[]>): IResolvedConfigurationInheritance {
		return {
			raw: result.raw,
			content: JSON.stringify(result.raw),
			resources: result.resources,
			diagnostics: [...diagnostics.values()].flatMap(value => value),
		};
	}

	private async resolveRaw(resource: URI, raw: unknown, stack: URI[], diagnostics: ResourceMap<IResourceMarker[]>): Promise<{ raw: ConfigurationObject; resources: URI[] }> {
		const configuration = deepClone(this.asConfigurationObject(raw));
		const resources = new ResourceMap<URI>();
		resources.set(resource, resource);

		const includePaths = this.parseIncludePaths(configuration, resource, diagnostics);
		delete configuration[CONFIGURATION_INHERITANCE_KEY];

		let merged: ConfigurationObject = {};
		for (const includePath of includePaths) {
			if (!this.isRelativeIncludePath(includePath)) {
				this.logService.error(`Rejected configuration inheritance '${includePath}' from '${resource.toString()}': '${CONFIGURATION_INHERITANCE_KEY}' must use relative paths.`);
				this.addDiagnostic(diagnostics, resource, localize('configurationInheritanceInvalidPath', "Configuration inheritance '{0}' must be a relative path within the configuration directory.", includePath));
				continue;
			}

			const includeResource = this.uriIdentityService.extUri.resolvePath(this.uriIdentityService.extUri.dirname(resource), includePath);
			if (!this.uriIdentityService.extUri.isEqualOrParent(includeResource, this.configurationRoot)) {
				this.logService.error(`Rejected configuration inheritance '${includePath}' from '${resource.toString()}': resolved target '${includeResource.toString()}' escapes '${this.configurationRoot.toString()}'.`);
				this.addDiagnostic(diagnostics, resource, localize('configurationInheritanceOutsideRoot', "Configuration inheritance '{0}' must stay within the configuration directory.", includePath));
				continue;
			}

			resources.set(includeResource, includeResource);

			if ([...stack, resource].some(ancestor => this.uriIdentityService.extUri.isEqual(ancestor, includeResource))) {
				const cycle = [...stack, resource, includeResource].map(value => value.toString()).join(' -> ');
				this.logService.error(`Configuration inheritance cycle detected: ${cycle}`);
				this.addDiagnostic(diagnostics, resource, localize('configurationInheritanceCycle', "Configuration inheritance cycle detected: {0}", cycle));
				continue;
			}

			const includeContent = await this.readConfigurationContent(includeResource);
			if (includeContent === undefined) {
				this.logService.error(`Unable to resolve configuration inheritance '${includePath}' from '${resource.toString()}'.`);
				this.addDiagnostic(diagnostics, resource, localize('configurationInheritanceMissing', "Cannot resolve configuration inheritance '{0}'.", includePath));
				continue;
			}

			const includeRaw = this.parseConfigurationContent(includeResource, includeContent, true, diagnostics);
			const resolved = await this.resolveRaw(includeResource, includeRaw, [...stack, resource], diagnostics);
			for (const resolvedResource of resolved.resources) {
				resources.set(resolvedResource, resolvedResource);
			}
			merged = this.mergeObjects(merged, resolved.raw);
		}

		merged = this.mergeObjects(merged, configuration);
		return { raw: merged, resources: [...resources.values()] };
	}

	private async readConfigurationContent(resource: URI): Promise<string | undefined> {
		try {
			return (await this.fileService.readFile(resource)).value.toString();
		} catch (error) {
			this.logService.trace(`Error while resolving configuration file '${resource.toString()}': ${errors.getErrorMessage(error)}`);
			if ((<FileOperationError>error).fileOperationResult !== FileOperationResult.FILE_NOT_FOUND
				&& (<FileOperationError>error).fileOperationResult !== FileOperationResult.FILE_NOT_DIRECTORY) {
				this.logService.error(error);
			}
		}
		return undefined;
	}

	private parseConfigurationContent(resource: URI, content: string | undefined, isIncluded: boolean, diagnostics: ResourceMap<IResourceMarker[]>): unknown {
		const parseErrors: json.ParseError[] = [];
		const text = content ?? '';
		const raw: unknown = json.parse(text, parseErrors, { allowEmptyContent: true, allowTrailingComma: true });
		if (parseErrors.length && isIncluded) {
			this.logService.error(`Invalid configuration inheritance '${resource.toString()}'.`);
			for (const parseError of parseErrors) {
				this.addDiagnostic(diagnostics, resource, localize('configurationInheritanceInvalidJson', "Invalid JSONC in inherited configuration file."), text, parseError.offset, parseError.length);
			}
			return {};
		}

		if (!this.isConfigurationObject(raw)) {
			if (isIncluded && raw !== undefined) {
				this.logService.error(`Invalid configuration inheritance '${resource.toString()}': expected an object at the top level.`);
				this.addDiagnostic(diagnostics, resource, localize('configurationInheritanceInvalidObject', "Inherited configuration file must contain a JSON object at the top level."));
			}
			return {};
		}

		return raw;
	}

	private parseIncludePaths(raw: ConfigurationObject, resource: URI, diagnostics: ResourceMap<IResourceMarker[]>): string[] {
		const value = raw[CONFIGURATION_INHERITANCE_KEY];
		if (typeof value === 'undefined') {
			return [];
		}
		if (typeof value === 'string') {
			return [value];
		}
		if (isStringArray(value)) {
			return value;
		}

		this.logService.error(`Invalid '${CONFIGURATION_INHERITANCE_KEY}' in configuration file '${resource.toString()}': expected a string or an array of strings.`);
		this.addDiagnostic(diagnostics, resource, localize('configurationInheritanceInvalidType', "'{0}' must be a string or an array of strings.", CONFIGURATION_INHERITANCE_KEY));
		return [];
	}

	private isRelativeIncludePath(includePath: string): boolean {
		if (!includePath.length) {
			return false;
		}
		if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(includePath)) {
			return false;
		}
		return includePath[0] !== '/' && includePath[0] !== '\\';
	}

	private addDiagnostic(diagnostics: ResourceMap<IResourceMarker[]>, resource: URI, message: string, content?: string, offset?: number, length?: number): void {
		let startLineNumber = 1;
		let startColumn = 1;
		let endLineNumber = 1;
		let endColumn = 1;

		if (typeof content === 'string' && typeof offset === 'number') {
			const start = this.getLineAndColumn(content, offset);
			const end = this.getLineAndColumn(content, offset + Math.max(length ?? 1, 1));
			startLineNumber = start.lineNumber;
			startColumn = start.column;
			endLineNumber = end.lineNumber;
			endColumn = end.column;
		}

		const resourceDiagnostics = diagnostics.get(resource) ?? [];
		resourceDiagnostics.push({
			resource,
			marker: {
				severity: MarkerSeverity.Error,
				source: localize('configurationInheritanceSource', "configuration"),
				message,
				startLineNumber,
				startColumn,
				endLineNumber,
				endColumn,
			}
		});
		diagnostics.set(resource, resourceDiagnostics);
	}

	private getLineAndColumn(content: string, offset: number): { lineNumber: number; column: number } {
		const clampedOffset = Math.min(Math.max(offset, 0), content.length);
		let lineNumber = 1;
		let column = 1;

		for (let index = 0; index < clampedOffset; index++) {
			const character = content.charCodeAt(index);
			if (character === 13 /* \r */) {
				if (content.charCodeAt(index + 1) === 10 /* \n */) {
					index++;
				}
				lineNumber++;
				column = 1;
			} else if (character === 10 /* \n */) {
				lineNumber++;
				column = 1;
			} else {
				column++;
			}
		}

		return { lineNumber, column };
	}

	private mergeObjects(source: ConfigurationObject, target: ConfigurationObject): ConfigurationObject {
		const result = deepClone(source);
		for (const key of Object.keys(target)) {
			const sourceValue = result[key];
			const targetValue = target[key];
			if (Object.hasOwn(result, key) && this.isConfigurationObject(sourceValue) && this.isConfigurationObject(targetValue)) {
				result[key] = this.mergeObjects(sourceValue, targetValue);
			} else {
				result[key] = deepClone(targetValue);
			}
		}
		return result;
	}

	private asConfigurationObject(raw: unknown): ConfigurationObject {
		return this.isConfigurationObject(raw) ? raw : {};
	}

	private isConfigurationObject(raw: unknown): raw is ConfigurationObject {
		return isObject(raw);
	}
}
