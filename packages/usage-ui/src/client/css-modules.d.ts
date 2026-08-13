/** CSS Modules ambient declaration for this package's client bundle. */

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
