# react-static-plugin-md-pages

<p>
  <a href="https://github.com/kitten/react-static-plugin-md-pages#maintenance-status">
    <img alt="Maintenance Status" src="https://img.shields.io/badge/maintenance-experimental-blueviolet.svg" />
  </a>
</p>

> A [react-static](https://react-static.js.org) plugin to create nested pages from a given source
> directory.

## Install

```sh
$ yarn add react-static-plugin-md-pages
# or
npm install --save react-static-plugin-md-pages
```

## Usage

Add the plugin to your `static.config.js` in the plugins array.

```js
// static.config.js
export default {
  plugins: [
    [
      'react-static-plugin-md-pages',
      {
        location: './docs', // path to markdown files' directory
        pathPrefix: '', // prefix for added react-static routes (if any)
        template: './src/template.js', // path to React template component
        remarkPlugins: [], // add additional remark plugins here
      }
    ]
  ]
};
```

Your markdown file may contain frontmatter data. This data will be
reflected in the data you'll get from this plugin's [React API](#react-api).

An example will look like this:

```
---
title: architecture
order: 1
template: ../src/components/template.js
---
```

All of these properties are **optional**. The `title` may be used to change
the page's title, but by default the plugin will generate a title from your
first `h1` heading in your markdown file.

The `order` property specifies the order in which your markdown files will
be sorted in, which will be reflected in the [React API](#react-api) as
well.

Lastly, the `template` property may be used to override the default React template component
that this specific page is using. The path must be relative to the current file.

### Default Markdown Transformations

There are a couple of changes and features that will be applied to your markdown content
automatically. It's best to be aware of them before adding your own `remark` plugins.

### Relative Links Fixes

If you're adding links to your markdown files they'll be transformed to automatically point
at the `react-static` routes this plugin creates, so that your markdown files may remain compatible
with GitHub for instance. These links will be transformed:

```md
[Some link](./other-route.md)
[Some other link](./folder/README.md)
```

And end up being this in `react-static`:

```md
[Some link](./other-route)
[Some other link](./folder)
```

> _Note_: This does not apply to `<a>` tags in your markdown file!

### Automatic Image Importing

When you're adding images to your markdown, they'll be automatically imported and sent through
the Webpack pipeline, so you won't have to reference images in your public folder absolutely.

```md
![This image will be imported!](./some-logo.png)
```

> _Note_: This does not apply to `<img>` tags in your markdown file!

### Addings anchor `id` props to headings

All headings (`h1`, `h2`, `h3`, ...) will have an added `id` prop that contains their sluggified
string contents. The slugger we use is `github-slugger`.

```md
# Before

<h1 id="after">After</h1>
```

Howver, you won't need to generate these slugs in your app code again if you plan on using anchor
tags. The data that the [React API](#react-api) returns contains headings and slug data for any
given markdown page.

## Plugin Options

### `location` (path to source directory)

The plugin will scan the given `location` folder directory for
`.md` files which will be added to `react-static` as individual pages.
The directories the markdown file is located in and the filename
itself will be taken into account when adding routes.

The search itself starts from the `react-static` root that is
configured in `config.paths.root` (which defaults to the current
working directory).

For instance, if location is set to `./docs` and the given list of
files is the following:

```
|- docs
   |- getting-started.md
   |- basics
      |- installation.md
   |- advanced
      |- README.md
      |- api.md
```

The output of routes will be:

- `/getting-started`
- `/basics/installation`
- `/advanced` (index route)
- `/api`

Any file that is named `README.md` or `index.md` (case-insensitive) will
be considered an index route. So in the example above `./docs/advanced/README.md`
became `/advanced` instead of `/advanced/readme`.

### `pathPrefix` (base path prefix for routes)

If this option is set, all routes will be prefixed with what you pass
to this option. For instance, setting it to `docs` will turn `/getting-started`
to `/docs/getting-started`.

### `template` (the React template component path)

Like with routes in `react-static`'s `getRoutes`, you'll likely want to wrap
your markdown content in React components. This may be done by pointing
`template` at your template component, e.g. `./src/components/template.js`.

When rendered the component will receive the markdown content as JSX, the
content will be passed as the `children` prop.

An example for a component may look like the following:

```js
// ./src/components/template.js
export default ({ children }) => (
  <main>
    {children}
  </main>
);
```

### `remarkPlugins` (a list of remark plugins)

Your markdown files will be parsed using [remark](https://github.com/remarkjs/remark)
before being converted to JSX on the client-side. You may pass more remark plugins
that your markdown will be run through during build time.

```
{
  remarkPlugins: [
    [require('remark-emoji'), { padSpaceAfter: true }]
  ]
}
```

### `order` (override the order of pages)

This may be used to override the order of some pages, which is useful for folders that
need sorting, but don't have index files (`README.md` or `index.md`).

The `order` config can be set to an object of `routeName` to a number, where the route's
name is either a folder name or a filename.

Since by default the order is alphabetic, if you have two folders, one named `basics/` and one
named `advanced/`, you can swap their order as so:

```js
{
  order: {
    basics: 0,
    advanced: 1,
  }
}
```

## React API

### Hooks

This plugin provides two hooks `useMarkdownPage` and `useMarkdownTree`. The former returns
information about the current page's markdown data and the latter returns a nested tree of
all markdown pages.

The `useMarkdownPage` hook is available as long as you are on any of the markdown page, `useMarkdownTree` is available in any react-static page.


```
useMarkdownPage()
// => Page

useMarkdownTree()
// => { ...Page, key: string, children: Page[] }
```

As shown above, the tree version of the hook returns additional data apart from the common
`Page` data, which also contains a `key` — the node's directory or filename — and children — the
child `Page`s or nodes.

A `Page` is an object that contains more information about the markdown file. Specifically it'll
contain:

- `path`: The route to the page, including the `pathPrefix` (if any has been set)
- `originalPath`: The original path to the markdown file (which is useful as a unique key)
- `frontmatter`: The JSON object of frontmatter data (*normalized)
- `headings`: A list of all `h1`, `h2`, and `h3` headings in the markdown file

The `frontmatter` data is normalised. This means that when your markdown file doesn't have any
frontmatter data it'll still be provided, and when you left out `frontmatter.title` it will default
to the page's first `h1` heading.

The `headings` array contains all `h1`, `h2`, and `h3` headings as objects. These objects have
a `value` property (the stringified content of the heading), a `slug` property (the slugified
content of the heading), and a depth property (`1 | 2 | 3` depending on the level of the heading.)

### Adding an MDX Provider

The JSX that the markdown content is rendered as internally uses
[`@mdx-js/react`](https://www.npmjs.com/package/@mdx-js/react). By default it will render out
as normal HTML-ified markdown content. However, it's possible to use the `MDXProvider` from
`@mdx-js/react` to modify the output.

[Read more about the `MDXProvider` in the MDX guides.](https://mdxjs.com/guides)

## Maintenance Status

**Experimental:** This project is quite new. We're not sure what our ongoing maintenance plan for this project will be. Bug reports, feature requests and pull requests are welcome. If you like this project, let us know!
