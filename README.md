## Usage

Those templates dependencies are maintained via [pnpm](https://pnpm.io) via `pnpm up -Lri`.

This is the reason you see a `pnpm-lock.yaml`. That being said, any package manager will work. This file can be safely be removed once you clone a template.

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## development

For local development you can use below command to start the application.

```
npx wrangler dev
```

## Deployment

You can deploy the `dist` folder to any static host provider (netlify, surge, now, etc.)

```
export CLOUDFLARE_API_TOKEN="your-cloudflare-token-here"
```

### Instructions for creating a Cloudflare API token

1. Go to https://dash.cloudflare.com/profile/api-tokens in your browser
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Make sure it has permissions for:
  - Account: Workers KV Storage: Edit
  - Account: Workers Scripts: Edit
5. Continue to summary and create the token
6. Copy the Cloudflare API token

Then you may run, below command to deploy to cloudflare.

```
npm run deploy
```
