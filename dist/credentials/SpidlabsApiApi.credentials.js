"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpidlabsApiApi = void 0;
class SpidlabsApiApi {
    constructor() {
        this.name = "spidlabsApiApi";
        this.displayName = "SpidLabs API";
        this.documentationUrl = "https://spidlabs.com";
        this.icon = {
            light: "file:../nodes/SpidlabsApi/spidlabsApi.svg",
            dark: "file:../nodes/SpidlabsApi/spidlabsApi.dark.svg"
        };
        this.properties = [
            {
                displayName: "X-API-Key",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    "X-API-Key": "={{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://spidlabs.com",
                url: "/api/blogs"
            }
        };
    }
}
exports.SpidlabsApiApi = SpidlabsApiApi;
//# sourceMappingURL=SpidlabsApiApi.credentials.js.map