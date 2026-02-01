[API Reference](/reference/react)

[Configuration](/reference/react-compiler/configuration)

# panicThreshold

The `panicThreshold` option controls how the React Compiler handles errors during compilation.
[code] 
    {  
    
    
      panicThreshold: 'none' // Recommended  
    
    
    }
[/code]

  * Reference 
    * `panicThreshold`
  * Usage 
    * Production configuration (recommended) 
    * Development debugging 



* * *

## Reference 

### `panicThreshold`

Determines whether compilation errors should fail the build or skip optimization.

#### Type 
[code] 
    'none' | 'critical_errors' | 'all_errors'
[/code]

#### Default value 

`'none'`

#### Options 

  * **`'none'`** (default, recommended): Skip components that can’t be compiled and continue building
  * **`'critical_errors'`** : Fail the build only on critical compiler errors
  * **`'all_errors'`** : Fail the build on any compiler diagnostic



#### Caveats 

  * Production builds should always use `'none'`
  * Build failures prevent your application from building
  * The compiler automatically detects and skips problematic code with `'none'`
  * Higher thresholds are only useful during development for debugging



* * *

## Usage 

### Production configuration (recommended) 

For production builds, always use `'none'`. This is the default value:
[code] 
    {  
    
    
      panicThreshold: 'none'  
    
    
    }
[/code]

This ensures:

  * Your build never fails due to compiler issues
  * Components that can’t be optimized run normally
  * Maximum components get optimized
  * Stable production deployments



### Development debugging 

Temporarily use stricter thresholds to find issues:
[code] 
    const isDevelopment = process.env.NODE_ENV === 'development';  
    
    
      
    
    
    {  
    
    
      panicThreshold: isDevelopment ? 'critical_errors' : 'none',  
    
    
      logger: {  
    
    
        logEvent(filename, event) {  
    
    
          if (isDevelopment && event.kind === 'CompileError') {  
    
    
            // ...  
    
    
          }  
    
    
        }  
    
    
      }  
    
    
    }
[/code]

[Previouslogger](/reference/react-compiler/logger)[Nexttarget](/reference/react-compiler/target)
