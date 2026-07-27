// Ambient declaration so side-effect CSS imports (`import './X.css'`) type-resolve.
// Components import CSS for its build-time side effect only (see README styling convention).
declare module '*.css' {}
