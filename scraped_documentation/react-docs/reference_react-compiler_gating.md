[API Reference](/reference/react)

[Configuration](/reference/react-compiler/configuration)

# gating

The `gating` option enables conditional compilation, allowing you to control when optimized code is used at runtime.
[code] 
    {  
    
    
      gating: {  
    
    
        source: 'my-feature-flags',  
    
    
        importSpecifierName: 'shouldUseCompiler'  
    
    
      }  
    
    
    }
[/code]

  * Reference 
    * `gating`
  * Usage 
    * Basic feature flag setup 
  * Troubleshooting 
    * Feature flag not working 
    * Import errors 



* * *

## Reference 

### `gating`

Configures runtime feature flag gating for compiled functions.

#### Type 
[code] 
    {  
    
    
      source: string;  
    
    
      importSpecifierName: string;  
    
    
    } | null
[/code]

#### Default value 

`null`

#### Properties 

  * **`source`** : Module path to import the feature flag from
  * **`importSpecifierName`** : Name of the exported function to import



#### Caveats 

  * The gating function must return a boolean
  * Both compiled and original versions increase bundle size
  * The import is added to every file with compiled functions



* * *

## Usage 

### Basic feature flag setup 

  1. Create a feature flag module:


[code] 
    // src/utils/feature-flags.js  
    
    
    export function shouldUseCompiler() {  
    
    
      // your logic here  
    
    
      return getFeatureFlag('react-compiler-enabled');  
    
    
    }
[/code]

  2. Configure the compiler:


[code] 
    {  
    
    
      gating: {  
    
    
        source: './src/utils/feature-flags',  
    
    
        importSpecifierName: 'shouldUseCompiler'  
    
    
      }  
    
    
    }
[/code]

  3. The compiler generates gated code:


[code] 
    // Input  
    
    
    function Button(props) {  
    
    
      return <button>{props.label}</button>;  
    
    
    }  
    
    
      
    
    
    // Output (simplified)  
    
    
    import { shouldUseCompiler } from './src/utils/feature-flags';  
    
    
      
    
    
    const Button = shouldUseCompiler()  
    
    
      ? function Button_optimized(props) { /* compiled version */ }  
    
    
      : function Button_original(props) { /* original version */ };
[/code]

Note that the gating function is evaluated once at module time, so once the JS bundle has been parsed and evaluated the choice of component stays static for the rest of the browser session.

* * *

## Troubleshooting 

### Feature flag not working 

Verify your flag module exports the correct function:
[code] 
    // ❌ Wrong: Default export  
    
    
    export default function shouldUseCompiler() {  
    
    
      return true;  
    
    
    }  
    
    
      
    
    
    // ✅ Correct: Named export matching importSpecifierName  
    
    
    export function shouldUseCompiler() {  
    
    
      return true;  
    
    
    }
[/code]

### Import errors 

Ensure the source path is correct:
[code] 
    // ❌ Wrong: Relative to babel.config.js  
    
    
    {  
    
    
      source: './src/flags',  
    
    
      importSpecifierName: 'flag'  
    
    
    }  
    
    
      
    
    
    // ✅ Correct: Module resolution path  
    
    
    {  
    
    
      source: '@myapp/feature-flags',  
    
    
      importSpecifierName: 'flag'  
    
    
    }  
    
    
      
    
    
    // ✅ Also correct: Absolute path from project root  
    
    
    {  
    
    
      source: './src/utils/flags',  
    
    
      importSpecifierName: 'flag'  
    
    
    }
[/code]

[PreviouscompilationMode](/reference/react-compiler/compilationMode)[Nextlogger](/reference/react-compiler/logger)
