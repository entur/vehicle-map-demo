declare module "*.svg";

declare module "*.css";

declare module "*.png";

declare module "*?worker&url" {
  const url: string;
  export default url;
}

declare module "*.svg?url" {
  const src: string;
  export default src;
}
