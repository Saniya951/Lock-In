[API Reference](/reference/react)

[Configuration](/reference/react-compiler/configuration)

# target

The `target` option specifies which React version the compiler should generate code for.
[code] 
    {  
    
    
      target: '19' // or '18', '17'  
    
    
    }
[/code]

  * Reference 
    * `target`
  * Usage 
    * Targeting React 19 (default) 
    * Targeting React 17 or 18 
  * Troubleshooting 
    * Runtime errors about missing compiler runtime 
    * Runtime package not working 
    * Checking compiled output 



* * *

## Reference 

### `target`

Configures the React version compatibility for the compiled output.

#### Type 
[code] 
    '17' | '18' | '19'
[/code]

#### Default value 

`'19'`

#### Valid values 

  * **`'19'`** : Target React 19 (default). No additional runtime required.
  * **`'18'`** : Target React 18. Requires `react-compiler-runtime` package.
  * **`'17'`** : Target React 17. Requires `react-compiler-runtime` package.



#### Caveats 

  * Always use string values, not numbers (e.g., `'17'` not `17`)
  * Don’t include patch versions (e.g., use `'18'` not `'18.2.0'`)
  * React 19 includes built-in compiler runtime APIs
  * React 17 and 18 require installing `react-compiler-runtime@latest`



* * *

## Usage 

### Targeting React 19 (default) 

For React 19, no special configuration is needed:
[code] 
    {  
    
    
      // defaults to target: '19'  
    
    
    }
[/code]

The compiler will use React 19’s built-in runtime APIs:
[code] 
    // Compiled output uses React 19's native APIs  
    
    
    import { c as _c } from 'react/compiler-runtime';
[/code]

### Targeting React 17 or 18 

For React 17 and React 18 projects, you need two steps:

  1. Install the runtime package:


[code] 
    npm install react-compiler-runtime@latest
[/code]

  2. Configure the target:


[code] 
    // For React 18  
    
    
    {  
    
    
      target: '18'  
    
    
    }  
    
    
      
    
    
    // For React 17  
    
    
    {  
    
    
      target: '17'  
    
    
    }
[/code]

The compiler will use the polyfill runtime for both versions:
[code] 
    // Compiled output uses the polyfill  
    
    
    import { c as _c } from 'react-compiler-runtime';
[/code]

* * *

## Troubleshooting 

### Runtime errors about missing compiler runtime 

If you see errors like “Cannot find module ‘react/compiler-runtime’“:

  1. Check your React version:
[code] npm why react
[/code]

  2. If using React 17 or 18, install the runtime:
[code] npm install react-compiler-runtime@latest
[/code]

  3. Ensure your target matches your React version:
[code] {  
         
         
           target: '18' // Must match your React major version  
         
         
         }
[/code]




### Runtime package not working 

Ensure the runtime package is:

  1. Installed in your project (not globally)
  2. Listed in your `package.json` dependencies
  3. The correct version (`@latest` tag)
  4. Not in `devDependencies` (it’s needed at runtime)



### Checking compiled output 

To verify the correct runtime is being used, note the different import (`react/compiler-runtime` for builtin, `react-compiler-runtime` standalone package for 17/18):
[code] 
    // For React 19 (built-in runtime)  
    
    
    import { c } from 'react/compiler-runtime'  
    
    
    //                      ^  
    
    
      
    
    
    // For React 17/18 (polyfill runtime)  
    
    
    import { c } from 'react-compiler-runtime'  
    
    
    //                      ^
[/code]

[PreviouspanicThreshold](/reference/react-compiler/panicThreshold)[NextDirectives](/reference/react-compiler/directives)
