# SpidLabs API n8n community node

testing

Generated from OpenAPI 1.0.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated API key credential in n8n before using the node.

## Supported operations

- `POST /api/blogs` - Create blog draft
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /api/blogs/{id}` - Delete blog
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/blogs/{id}` - Get blog by ID
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/blogs` - Get all blogs
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/blogs/{id}/publish` - Publish draft blog
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /api/blogs/{id}` - Update blog
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/contact` - Submit contact form
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **SpidLabs API** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **SpidLabs API** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **SpidLabs API** display name.
