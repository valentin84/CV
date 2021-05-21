# About

This is a simple and clean CV template built in [Svelte](https://svelte.dev/) you can deploy for yourself right here on github pages.
You can freely copy and or modify it to your desire. 


```bash
cd the_folder_you_want_to_clone_in
git clone https://github.com/valentin84/CV.git
cd CV
```
---


## Get started

Install the dependencies...

```bash
npm install
```

...then start [Rollup](https://rollupjs.org):

```bash
npm run dev
```
Navigate to [localhost:5000](http://localhost:5000). You should see your app running. 


Change the cv.json with your details and replace profilePic.PNG with your own profile picture.

Create a new repository on your github for this project and push the local content to it. 

```bash
git add .
git commit -m "first commit"
git remove add origin <your repository url>
git push origin master
```
---

## Deploy

After replacing the content and pushing to your repository it is time to deploy to github pages:

```bash
npm run build
```
---

And the final product should look something like this [myCV](https://valentin84.github.io/CV/)


Thank you.
 








By default, the server will only respond to requests from localhost. To allow connections from other computers, edit the `sirv` commands in package.json to include the option `--host 0.0.0.0`.

If you're using [Visual Studio Code](https://code.visualstudio.com/) we recommend installing the official extension [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode). If you are using other editors you may need to install a plugin in order to get syntax highlighting and intellisense.

## Building and running in production mode

To create an optimised version of the app:

```bash
npm run build
```

You can run the newly built app with `npm run start`. This uses [sirv](https://github.com/lukeed/sirv), which is included in your package.json's `dependencies` so that the app will work when you deploy to platforms like [Heroku](https://heroku.com).


## Single-page app mode

By default, sirv will only respond to requests that match files in `public`. This is to maximise compatibility with static fileservers, allowing you to deploy your app anywhere.

If you're building a single-page app (SPA) with multiple routes, sirv needs to be able to respond to requests for *any* path. You can make it so by editing the `"start"` command in package.json:

```js
"start": "sirv public --single"
```

## Using TypeScript

This template comes with a script to set up a TypeScript development environment, you can run it immediately after cloning the template with:

```bash
node scripts/setupTypeScript.js
```

Or remove the script via:

```bash
rm scripts/setupTypeScript.js
```

## Deploying to the web

### With [Vercel](https://vercel.com)

Install `vercel` if you haven't already:

```bash
npm install -g vercel
```

Then, from within your project folder:

```bash
cd public
vercel deploy --name my-project
```

### With [surge](https://surge.sh/)

Install `surge` if you haven't already:

```bash
npm install -g surge
```

Then, from within your project folder:

```bash
npm run build
surge public my-project.surge.sh
```
