export interface AttributeMapping {
	[key: string]: string;
}

/**
 * Serialize a value to a string.
 *
 * @param value - The value to serialize.
 * @returns The serialized value.
 */
// biome-ignore lint/suspicious/noExplicitAny: Allow any
export function safeSerialize(value: any): string {
	try {
		return JSON.stringify(value, (_key, val) => {
			if (val === null) {
				// Preserve null values in the JSON string.
				return null;
			}
			if (val !== null && typeof val === "object") {
				return val;
			}
			return val ?? String(val);
		});
	} catch {
		return String(value);
	}
}

/**
 * Extract attributes from a data object using a mapping.
 *
 * @param data - The data object to extract attributes from.
 * @param mapping - The mapping of target attributes to source data keys.
 * @returns The extracted attributes.
 */
export function extractAttributesFromMapping(
	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	data: Record<string, any>,
	mapping: AttributeMapping,
): AttributeMapping {
	const attributes: AttributeMapping = {};

	for (const [target, source] of Object.entries(mapping)) {
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		let value: any;
		if (typeof data === "object" && data !== null && source in data) {
			value = data[source];
		} else {
			continue;
		}

		if (typeof value === "string") {
			value = safeSerialize(value);
		}

		attributes[target] = value;
	}

	return attributes;
}

/**
 * Extract attributes from a data object using a mapping with an index placeholder.
 *
 * @param data - The data object to extract attributes from.
 * @param mapping - The mapping of target attributes to source data keys.
 * @param index - The index to replace the placeholder in the mapping.
 * @returns The extracted attributes.
 */
export function extractAttributesFromMappingWithIndex(
	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	data: Record<string, any>,
	mapping: AttributeMapping,
	index: number,
): AttributeMapping {
	const attributes: AttributeMapping = {};

	for (const [target, source] of Object.entries(mapping)) {
		const formattedSource = source.replace(/\{i\}/, String(index));
		attributes[target] = formattedSource;
	}

	return extractAttributesFromMapping(data, attributes);
}

/**
 * Extract attributes from an array of items using a mapping.
 *
 * @param items - The array of items to extract attributes from.
 * @param mapping - The mapping of target attributes to source data keys.
 * @returns The extracted attributes.
 */
export function extractAttributesFromArray(
	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	items: Array<any>,
	mapping: AttributeMapping,
): AttributeMapping {
	const attributes: AttributeMapping = {};

	items.forEach((item, index) => {
		Object.assign(
			attributes,
			extractAttributesFromMappingWithIndex(item, mapping, index),
		);
	});

	return attributes;
}
