"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpidlabsApi = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class SpidlabsApi {
    constructor() {
        this.description = {
            displayName: "SpidLabs API",
            name: "spidlabsApi",
            icon: {
                light: "file:spidlabsApi.svg",
                dark: "file:spidlabsApi.dark.svg"
            },
            group: [],
            version: [
                1
            ],
            subtitle: "={{$parameter[\"operation\"] + \": \" + $parameter[\"resource\"]}}",
            description: "testing",
            defaults: {
                name: "SpidLabs API"
            },
            usableAsTool: true,
            inputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            credentials: [
                {
                    name: "spidlabsApiApi",
                    required: true
                }
            ],
            properties: [
                {
                    displayName: "Resource",
                    name: "resource",
                    type: "options",
                    noDataExpression: true,
                    default: "blogs",
                    options: [
                        {
                            name: "Blog",
                            value: "blogs"
                        },
                        {
                            name: "Contact",
                            value: "contact"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ]
                        }
                    },
                    default: "createBlogDraft",
                    options: [
                        {
                            name: "Create Blog Draft",
                            value: "createBlogDraft",
                            action: "Create blog draft",
                            description: "Creates a new draft blog post. publication fields cannot be set through this operation."
                        },
                        {
                            name: "Delete",
                            value: "deleteBlog",
                            action: "Delete blog",
                            description: "Soft deletes a blog post by setting deleted_at"
                        },
                        {
                            name: "Get All",
                            value: "listBlogs",
                            action: "Get all blogs",
                            description: "Returns non-deleted blog posts, optionally filtered by publication status"
                        },
                        {
                            name: "Get Blog By ID",
                            value: "getBlogById",
                            action: "Get blog by ID",
                            description: "Returns one non-deleted blog post"
                        },
                        {
                            name: "Publish Draft",
                            value: "publishBlog",
                            action: "Publish draft blog",
                            description: "Publishes a blog post and preserves an existing published_at value when present"
                        },
                        {
                            name: "Update",
                            value: "updateBlog",
                            action: "Update blog",
                            description: "Partially updates blog fields without changing publication state"
                        }
                    ]
                },
                {
                    displayName: "Blog Content",
                    name: "blog_content",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Cms-compatible HTML content",
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Canonical URL",
                    name: "canonical_url",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Category",
                    name: "category",
                    type: "options",
                    default: "Automation",
                    required: true,
                    options: [
                        {
                            name: "Agentic AI",
                            value: "Agentic AI"
                        },
                        {
                            name: "Automation",
                            value: "Automation"
                        },
                        {
                            name: "Browser Automation",
                            value: "Browser Automation"
                        },
                        {
                            name: "Company",
                            value: "Company"
                        },
                        {
                            name: "Engineering",
                            value: "Engineering"
                        },
                        {
                            name: "Operations",
                            value: "Operations"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Faq Items",
                    name: "faq_items",
                    type: "json",
                    default: [],
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Featured Image",
                    name: "featured_image",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Featured Image Alt",
                    name: "featured_image_alt",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Focus Keyword",
                    name: "focus_keyword",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Og Description",
                    name: "og_description",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Og Image",
                    name: "og_image",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Og Image Alt",
                    name: "og_image_alt",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Og Title",
                    name: "og_title",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Reading Time",
                    name: "reading_time",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Schema Type",
                    name: "schema_type",
                    type: "options",
                    default: "BlogPosting",
                    required: true,
                    options: [
                        {
                            name: "Article",
                            value: "Article"
                        },
                        {
                            name: "BlogPosting",
                            value: "BlogPosting"
                        },
                        {
                            name: "TechArticle",
                            value: "TechArticle"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Seo Description",
                    name: "seo_description",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Seo Keywords",
                    name: "seo_keywords",
                    type: "json",
                    default: [],
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Seo Title",
                    name: "seo_title",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Short Description",
                    name: "short_description",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Slug",
                    name: "slug",
                    type: "string",
                    default: "",
                    required: true,
                    hint: "Expected format: ^[a-z0-9]+(?:-[a-z0-9]+)*$",
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Title",
                    name: "title",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Tldr",
                    name: "tldr",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Twitter Description",
                    name: "twitter_description",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Twitter Image",
                    name: "twitter_image",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Twitter Image Alt",
                    name: "twitter_image_alt",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Twitter Title",
                    name: "twitter_title",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "createBlogDraft"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Authors",
                            name: "authors",
                            type: "json",
                            default: [],
                            description: "Defaults to the cms default author when omitted"
                        },
                        {
                            displayName: "Robots Follow",
                            name: "robots_follow",
                            type: "boolean",
                            default: true,
                            description: "Whether to enable robots follow"
                        },
                        {
                            displayName: "Robots Index",
                            name: "robots_index",
                            type: "boolean",
                            default: true,
                            description: "Whether to enable robots index"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Blog post UUID",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "deleteBlog"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Blog post UUID",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "getBlogById"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "listBlogs"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "all",
                            description: "Publication status filter. defaults to all.",
                            options: [
                                {
                                    name: "All",
                                    value: "all"
                                },
                                {
                                    name: "Draft",
                                    value: "draft"
                                },
                                {
                                    name: "Published",
                                    value: "published"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Blog post UUID",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "publishBlog"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Blog post UUID",
                    hint: "Expected format: uuid",
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "updateBlog"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "blogs"
                            ],
                            operation: [
                                "updateBlog"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Authors",
                            name: "authors",
                            type: "json",
                            default: []
                        },
                        {
                            displayName: "Blog Content",
                            name: "blog_content",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Canonical URL",
                            name: "canonical_url",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Category",
                            name: "category",
                            type: "options",
                            default: "Automation",
                            options: [
                                {
                                    name: "Agentic AI",
                                    value: "Agentic AI"
                                },
                                {
                                    name: "Automation",
                                    value: "Automation"
                                },
                                {
                                    name: "Browser Automation",
                                    value: "Browser Automation"
                                },
                                {
                                    name: "Company",
                                    value: "Company"
                                },
                                {
                                    name: "Engineering",
                                    value: "Engineering"
                                },
                                {
                                    name: "Operations",
                                    value: "Operations"
                                }
                            ]
                        },
                        {
                            displayName: "Faq Items",
                            name: "faq_items",
                            type: "json",
                            default: []
                        },
                        {
                            displayName: "Featured Image",
                            name: "featured_image",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Featured Image Alt",
                            name: "featured_image_alt",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Focus Keyword",
                            name: "focus_keyword",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Og Description",
                            name: "og_description",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Og Image",
                            name: "og_image",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Og Image Alt",
                            name: "og_image_alt",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Og Title",
                            name: "og_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Reading Time",
                            name: "reading_time",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Robots Follow",
                            name: "robots_follow",
                            type: "boolean",
                            default: false,
                            description: "Whether to enable robots follow"
                        },
                        {
                            displayName: "Robots Index",
                            name: "robots_index",
                            type: "boolean",
                            default: false,
                            description: "Whether to enable robots index"
                        },
                        {
                            displayName: "Schema Type",
                            name: "schema_type",
                            type: "options",
                            default: "BlogPosting",
                            options: [
                                {
                                    name: "Article",
                                    value: "Article"
                                },
                                {
                                    name: "BlogPosting",
                                    value: "BlogPosting"
                                },
                                {
                                    name: "TechArticle",
                                    value: "TechArticle"
                                }
                            ]
                        },
                        {
                            displayName: "Seo Description",
                            name: "seo_description",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Seo Keywords",
                            name: "seo_keywords",
                            type: "json",
                            default: []
                        },
                        {
                            displayName: "Seo Title",
                            name: "seo_title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Short Description",
                            name: "short_description",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Slug",
                            name: "slug",
                            type: "string",
                            default: "",
                            hint: "Expected format: ^[a-z0-9]+(?:-[a-z0-9]+)*$"
                        },
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Tldr",
                            name: "tldr",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Twitter Description",
                            name: "twitter_description",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Twitter Image",
                            name: "twitter_image",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Twitter Image Alt",
                            name: "twitter_image_alt",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Twitter Title",
                            name: "twitter_title",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contact"
                            ]
                        }
                    },
                    default: "submitContactForm",
                    options: [
                        {
                            name: "Submit Contact Form",
                            value: "submitContactForm",
                            action: "Submit contact form",
                            description: "Validates a website contact request and forwards it to the configured contact webhook"
                        }
                    ]
                },
                {
                    displayName: "Description",
                    name: "description",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contact"
                            ],
                            operation: [
                                "submitContactForm"
                            ]
                        }
                    }
                },
                {
                    displayName: "Email",
                    name: "email",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "name@email.com",
                    hint: "Expected format: email",
                    displayOptions: {
                        show: {
                            resource: [
                                "contact"
                            ],
                            operation: [
                                "submitContactForm"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contact"
                            ],
                            operation: [
                                "submitContactForm"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contact"
                            ],
                            operation: [
                                "submitContactForm"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Country Code",
                            name: "countryCode",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Phone",
                            name: "phone",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Website",
                            name: "website",
                            type: "string",
                            default: "",
                            description: "Honeypot field. clients should leave it empty."
                        }
                    ]
                }
            ]
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "createBlogDraft": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/blogs";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["authors"] !== undefined)
                            setBodyField(body, { "name": "authors", "displayName": "Authors", "type": "array", "description": "Defaults to the CMS default author when omitted.", "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "avatar", "displayName": "Avatar", "type": "string", "format": "uri" }, { "name": "bio", "displayName": "Bio", "type": "string" }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "profile_url", "displayName": "Profile url", "type": "string", "format": "uri" }, { "name": "role", "displayName": "Role", "type": "string" }], "representation": "raw" }, "representation": "raw" }, additionalFields["authors"], this, itemIndex);
                        setBodyField(body, { "name": "blog_content", "displayName": "Blog content", "type": "string", "required": true, "description": "CMS-compatible HTML content." }, this.getNodeParameter("blog_content", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "canonical_url", "displayName": "Canonical url", "type": "string", "required": true }, this.getNodeParameter("canonical_url", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "category", "displayName": "Category", "type": "string", "required": true, "enum": ["Automation", "Agentic AI", "Browser Automation", "Operations", "Engineering", "Company"] }, this.getNodeParameter("category", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "faq_items", "displayName": "Faq items", "type": "array", "required": true, "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "answer", "displayName": "Answer", "type": "string", "required": true }, { "name": "question", "displayName": "Question", "type": "string", "required": true }], "representation": "raw" }, "representation": "raw" }, this.getNodeParameter("faq_items", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "featured_image", "displayName": "Featured image", "type": "string", "required": true }, this.getNodeParameter("featured_image", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "featured_image_alt", "displayName": "Featured image alt", "type": "string", "required": true }, this.getNodeParameter("featured_image_alt", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "focus_keyword", "displayName": "Focus keyword", "type": "string", "required": true }, this.getNodeParameter("focus_keyword", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "og_description", "displayName": "Og description", "type": "string", "required": true }, this.getNodeParameter("og_description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "og_image", "displayName": "Og image", "type": "string", "required": true }, this.getNodeParameter("og_image", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "og_image_alt", "displayName": "Og image alt", "type": "string", "required": true }, this.getNodeParameter("og_image_alt", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "og_title", "displayName": "Og title", "type": "string", "required": true }, this.getNodeParameter("og_title", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "reading_time", "displayName": "Reading time", "type": "string", "required": true }, this.getNodeParameter("reading_time", itemIndex), this, itemIndex);
                        if (additionalFields["robots_follow"] !== undefined)
                            setBodyField(body, { "name": "robots_follow", "displayName": "Robots follow", "type": "boolean", "default": true }, additionalFields["robots_follow"], this, itemIndex);
                        if (additionalFields["robots_index"] !== undefined)
                            setBodyField(body, { "name": "robots_index", "displayName": "Robots index", "type": "boolean", "default": true }, additionalFields["robots_index"], this, itemIndex);
                        setBodyField(body, { "name": "schema_type", "displayName": "Schema type", "type": "string", "required": true, "enum": ["BlogPosting", "Article", "TechArticle"] }, this.getNodeParameter("schema_type", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "seo_description", "displayName": "Seo description", "type": "string", "required": true }, this.getNodeParameter("seo_description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "seo_keywords", "displayName": "Seo keywords", "type": "array", "required": true, "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, this.getNodeParameter("seo_keywords", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "seo_title", "displayName": "Seo title", "type": "string", "required": true }, this.getNodeParameter("seo_title", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "short_description", "displayName": "Short description", "type": "string", "required": true }, this.getNodeParameter("short_description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "slug", "displayName": "Slug", "type": "string", "required": true, "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$" }, this.getNodeParameter("slug", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "title", "displayName": "Title", "type": "string", "required": true }, this.getNodeParameter("title", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "tldr", "displayName": "Tldr", "type": "string", "required": true }, this.getNodeParameter("tldr", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "twitter_description", "displayName": "Twitter description", "type": "string", "required": true }, this.getNodeParameter("twitter_description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "twitter_image", "displayName": "Twitter image", "type": "string", "required": true }, this.getNodeParameter("twitter_image", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "twitter_image_alt", "displayName": "Twitter image alt", "type": "string", "required": true }, this.getNodeParameter("twitter_image_alt", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "twitter_title", "displayName": "Twitter title", "type": "string", "required": true }, this.getNodeParameter("twitter_title", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://spidlabs.com", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "spidlabsApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "message", "success"], simplified: ["data", "message", "success"] };
                        errorPlan = { "400": { "title": "Invalid request." }, "401": { "title": "Missing, invalid, revoked, or expired API key." }, "409": { "title": "A blog post already uses the requested slug." }, "500": { "title": "Internal API error." } };
                        break;
                    }
                    case "deleteBlog": {
                        let path = "/api/blogs/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://spidlabs.com", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "spidlabsApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "message", "success"], simplified: ["data", "message", "success"] };
                        errorPlan = { "400": { "title": "Invalid request." }, "401": { "title": "Missing, invalid, revoked, or expired API key." }, "404": { "title": "Blog post not found." }, "500": { "title": "Internal API error." } };
                        break;
                    }
                    case "getBlogById": {
                        let path = "/api/blogs/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://spidlabs.com", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "spidlabsApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "success"], simplified: ["data", "success"] };
                        errorPlan = { "401": { "title": "Missing, invalid, revoked, or expired API key." }, "404": { "title": "Blog post not found." }, "500": { "title": "Internal API error." } };
                        break;
                    }
                    case "listBlogs": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/blogs";
                        const qs = {};
                        const body = {};
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        const serverBaseUrl = { url: "https://spidlabs.com", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "spidlabsApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "success"], simplified: ["data", "success"] };
                        errorPlan = { "400": { "title": "Invalid request." }, "401": { "title": "Missing, invalid, revoked, or expired API key." }, "500": { "title": "Internal API error." } };
                        break;
                    }
                    case "publishBlog": {
                        let path = "/api/blogs/{id}/publish";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://spidlabs.com", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "spidlabsApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "message", "success"], simplified: ["data", "message", "success"] };
                        errorPlan = { "400": { "title": "Invalid request." }, "401": { "title": "Missing, invalid, revoked, or expired API key." }, "404": { "title": "Blog post not found." }, "500": { "title": "Internal API error." } };
                        break;
                    }
                    case "updateBlog": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/blogs/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["authors"] !== undefined)
                            setBodyField(body, { "name": "authors", "displayName": "Authors", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "avatar", "displayName": "Avatar", "type": "string", "format": "uri" }, { "name": "bio", "displayName": "Bio", "type": "string" }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "profile_url", "displayName": "Profile url", "type": "string", "format": "uri" }, { "name": "role", "displayName": "Role", "type": "string" }], "representation": "raw" }, "representation": "raw" }, additionalFields["authors"], this, itemIndex);
                        if (additionalFields["blog_content"] !== undefined)
                            setBodyField(body, { "name": "blog_content", "displayName": "Blog content", "type": "string" }, additionalFields["blog_content"], this, itemIndex);
                        if (additionalFields["canonical_url"] !== undefined)
                            setBodyField(body, { "name": "canonical_url", "displayName": "Canonical url", "type": "string" }, additionalFields["canonical_url"], this, itemIndex);
                        if (additionalFields["category"] !== undefined)
                            setBodyField(body, { "name": "category", "displayName": "Category", "type": "string", "enum": ["Automation", "Agentic AI", "Browser Automation", "Operations", "Engineering", "Company"] }, additionalFields["category"], this, itemIndex);
                        if (additionalFields["faq_items"] !== undefined)
                            setBodyField(body, { "name": "faq_items", "displayName": "Faq items", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "answer", "displayName": "Answer", "type": "string", "required": true }, { "name": "question", "displayName": "Question", "type": "string", "required": true }], "representation": "raw" }, "representation": "raw" }, additionalFields["faq_items"], this, itemIndex);
                        if (additionalFields["featured_image"] !== undefined)
                            setBodyField(body, { "name": "featured_image", "displayName": "Featured image", "type": "string" }, additionalFields["featured_image"], this, itemIndex);
                        if (additionalFields["featured_image_alt"] !== undefined)
                            setBodyField(body, { "name": "featured_image_alt", "displayName": "Featured image alt", "type": "string" }, additionalFields["featured_image_alt"], this, itemIndex);
                        if (additionalFields["focus_keyword"] !== undefined)
                            setBodyField(body, { "name": "focus_keyword", "displayName": "Focus keyword", "type": "string" }, additionalFields["focus_keyword"], this, itemIndex);
                        if (additionalFields["og_description"] !== undefined)
                            setBodyField(body, { "name": "og_description", "displayName": "Og description", "type": "string" }, additionalFields["og_description"], this, itemIndex);
                        if (additionalFields["og_image"] !== undefined)
                            setBodyField(body, { "name": "og_image", "displayName": "Og image", "type": "string" }, additionalFields["og_image"], this, itemIndex);
                        if (additionalFields["og_image_alt"] !== undefined)
                            setBodyField(body, { "name": "og_image_alt", "displayName": "Og image alt", "type": "string" }, additionalFields["og_image_alt"], this, itemIndex);
                        if (additionalFields["og_title"] !== undefined)
                            setBodyField(body, { "name": "og_title", "displayName": "Og title", "type": "string" }, additionalFields["og_title"], this, itemIndex);
                        if (additionalFields["reading_time"] !== undefined)
                            setBodyField(body, { "name": "reading_time", "displayName": "Reading time", "type": "string" }, additionalFields["reading_time"], this, itemIndex);
                        if (additionalFields["robots_follow"] !== undefined)
                            setBodyField(body, { "name": "robots_follow", "displayName": "Robots follow", "type": "boolean" }, additionalFields["robots_follow"], this, itemIndex);
                        if (additionalFields["robots_index"] !== undefined)
                            setBodyField(body, { "name": "robots_index", "displayName": "Robots index", "type": "boolean" }, additionalFields["robots_index"], this, itemIndex);
                        if (additionalFields["schema_type"] !== undefined)
                            setBodyField(body, { "name": "schema_type", "displayName": "Schema type", "type": "string", "enum": ["BlogPosting", "Article", "TechArticle"] }, additionalFields["schema_type"], this, itemIndex);
                        if (additionalFields["seo_description"] !== undefined)
                            setBodyField(body, { "name": "seo_description", "displayName": "Seo description", "type": "string" }, additionalFields["seo_description"], this, itemIndex);
                        if (additionalFields["seo_keywords"] !== undefined)
                            setBodyField(body, { "name": "seo_keywords", "displayName": "Seo keywords", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, additionalFields["seo_keywords"], this, itemIndex);
                        if (additionalFields["seo_title"] !== undefined)
                            setBodyField(body, { "name": "seo_title", "displayName": "Seo title", "type": "string" }, additionalFields["seo_title"], this, itemIndex);
                        if (additionalFields["short_description"] !== undefined)
                            setBodyField(body, { "name": "short_description", "displayName": "Short description", "type": "string" }, additionalFields["short_description"], this, itemIndex);
                        if (additionalFields["slug"] !== undefined)
                            setBodyField(body, { "name": "slug", "displayName": "Slug", "type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$" }, additionalFields["slug"], this, itemIndex);
                        if (additionalFields["title"] !== undefined)
                            setBodyField(body, { "name": "title", "displayName": "Title", "type": "string" }, additionalFields["title"], this, itemIndex);
                        if (additionalFields["tldr"] !== undefined)
                            setBodyField(body, { "name": "tldr", "displayName": "Tldr", "type": "string" }, additionalFields["tldr"], this, itemIndex);
                        if (additionalFields["twitter_description"] !== undefined)
                            setBodyField(body, { "name": "twitter_description", "displayName": "Twitter description", "type": "string" }, additionalFields["twitter_description"], this, itemIndex);
                        if (additionalFields["twitter_image"] !== undefined)
                            setBodyField(body, { "name": "twitter_image", "displayName": "Twitter image", "type": "string" }, additionalFields["twitter_image"], this, itemIndex);
                        if (additionalFields["twitter_image_alt"] !== undefined)
                            setBodyField(body, { "name": "twitter_image_alt", "displayName": "Twitter image alt", "type": "string" }, additionalFields["twitter_image_alt"], this, itemIndex);
                        if (additionalFields["twitter_title"] !== undefined)
                            setBodyField(body, { "name": "twitter_title", "displayName": "Twitter title", "type": "string" }, additionalFields["twitter_title"], this, itemIndex);
                        const serverBaseUrl = { url: "https://spidlabs.com", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "spidlabsApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "message", "success"], simplified: ["data", "message", "success"] };
                        errorPlan = { "400": { "title": "Invalid request." }, "401": { "title": "Missing, invalid, revoked, or expired API key." }, "404": { "title": "Blog post not found." }, "409": { "title": "A blog post already uses the requested slug." }, "500": { "title": "Internal API error." } };
                        break;
                    }
                    case "submitContactForm": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/contact";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["countryCode"] !== undefined)
                            setBodyField(body, { "name": "countryCode", "displayName": "Country Code", "type": "string", "default": "" }, additionalFields["countryCode"], this, itemIndex);
                        setBodyField(body, { "name": "description", "displayName": "Description", "type": "string", "required": true }, this.getNodeParameter("description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "email", "displayName": "Email", "type": "string", "format": "email", "required": true }, this.getNodeParameter("email", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        if (additionalFields["phone"] !== undefined)
                            setBodyField(body, { "name": "phone", "displayName": "Phone", "type": "string", "default": "" }, additionalFields["phone"], this, itemIndex);
                        if (additionalFields["website"] !== undefined)
                            setBodyField(body, { "name": "website", "displayName": "Website", "type": "string", "description": "Honeypot field. Clients should leave it empty.", "default": "" }, additionalFields["website"], this, itemIndex);
                        const serverBaseUrl = { url: "https://spidlabs.com", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "spidlabsApiApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["delivered", "message", "ok"], simplified: ["delivered", "message", "ok"] };
                        errorPlan = { "400": { "title": "Invalid contact form data." }, "500": { "title": "Contact webhook is not configured." }, "502": { "title": "The contact webhook rejected the request or could not be reached." } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.SpidlabsApi = SpidlabsApi;
//# sourceMappingURL=SpidlabsApi.node.js.map