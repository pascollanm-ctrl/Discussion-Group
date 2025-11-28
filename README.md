# Clinical Medicine Resource Hub

## Fixing the "White Page" on Deployment
Browsers cannot run `.tsx` files directly. To host this on GitHub Pages or Vercel, you must build the project.

### How to Run Locally
1. `npm install`
2. `npm run dev`

### How to Deploy
1. Run `npm run build`
2. This creates a `dist` folder.
3. Upload the contents of the `dist` folder to your web host, or configure your GitHub Action to deploy the `dist` folder.

## Environment Variables
Ensure you set your `API_KEY` in your environment or `.env` file for the AI features to work.
