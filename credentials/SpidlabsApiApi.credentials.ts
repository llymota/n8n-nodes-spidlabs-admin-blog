import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class SpidlabsApiApi implements ICredentialType {
  name = "spidlabsApiApi";
  displayName = "SpidLabs API";
  documentationUrl = "https://spidlabs.com";
  icon: Icon = {
        light: "file:../nodes/SpidlabsApi/spidlabsApi.svg",
        dark: "file:../nodes/SpidlabsApi/spidlabsApi.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                "X-API-Key": "={{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://spidlabs.com",
            url: "/api/blogs"
        }
    };
}
