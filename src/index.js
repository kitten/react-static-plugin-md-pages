import { useRouteData } from 'react-static';
import { mdx } from '@mdx-js/react';

/** Recursively convert an MDX-compatible HAST to JSX */
export const hastToMdx = (node, assets, i = 0) => {
  let children = null;
  if (node.children && node.children.length === 1) {
    children = hastToMdx(node.children[0], assets);
  } else if (node.children && node.children.length > 1) {
    children = node.children.map((node, i) => hastToMdx(node, assets, i));
  }

  switch (node.type) {
    case 'text':
      return node.value;
    case 'root':
      return children;
    case 'element':
      const props = {
        ...node.properties,
        children,
        key: i,
      };

      // Normalise className props to consistently be strings
      if (Array.isArray(props.className))
        props.className = props.className.join(' ');

      // Given a dictionary of image files, read the Webpack-included
      // output path and replace the `src` path.
      if (node.tagName === 'img') props.src = assets[props.src] || props.src;

      return mdx(node.tagName, props);
    default:
      return null;
  }
};

/** Returns the current page's markdown data */
let previousPage;
export const useMarkdownPage = () => {
  let page;
  try {
    page = useRouteData().page;
  } catch (err) {
    if (err && typeof err.then === 'function') {
      throw err;
    }

    return previousPage;
  }

  if (!page || !page.frontmatter) return previousPage;
  return (previousPage = page);
};

/* Returns all page's nested markdown data */
let pages;
export const useMarkdownTree = () => {
  let pagesData;
  try {
    pagesData = useRouteData().pages || undefined;
  } catch (err) {
    if (err && typeof err.then === 'function') {
      throw err;
    }
  }

  return pages || (pages = pagesData);
};
