[API Reference](/reference/react)

[APIs](/reference/react/apis)

# createContext

`createContext` lets you create a [context](/learn/passing-data-deeply-with-context) that components can provide or read.
[code]
    const SomeContext = createContext(defaultValue)
[/code]

  * Reference 
    * `createContext(defaultValue)`
    * `SomeContext` Provider 
    * `SomeContext.Consumer`
  * Usage 
    * Creating context 
    * Importing and exporting context from a file 
  * Troubleshooting 
    * I can’t find a way to change the context value 



* * *

## Reference 

### `createContext(defaultValue)`

Call `createContext` outside of any components to create a context.
[code] 
    import { createContext } from 'react';  
    
    
      
    
    
    const ThemeContext = createContext('light');
[/code]

See more examples below.

#### Parameters 

  * `defaultValue`: The value that you want the context to have when there is no matching context provider in the tree above the component that reads context. If you don’t have any meaningful default value, specify `null`. The default value is meant as a “last resort” fallback. It is static and never changes over time.



#### Returns 

`createContext` returns a context object.

**The context object itself does not hold any information.** It represents _which_ context other components read or provide. Typically, you will use `SomeContext` in components above to specify the context value, and call [`useContext(SomeContext)`](/reference/react/useContext) in components below to read it. The context object has a few properties:

  * `SomeContext` lets you provide the context value to components.
  * `SomeContext.Consumer` is an alternative and rarely used way to read the context value.
  * `SomeContext.Provider` is a legacy way to provide the context value before React 19.



* * *

### `SomeContext` Provider 

Wrap your components into a context provider to specify the value of this context for all components inside:
[code] 
    function App() {  
    
    
      const [theme, setTheme] = useState('light');  
    
    
      // ...  
    
    
      return (  
    
    
        <ThemeContext value={theme}>  
    
    
          <Page />  
    
    
        </ThemeContext>  
    
    
      );  
    
    
    }
[/code]

### Note

Starting in React 19, you can render `<SomeContext>` as a provider.

In older versions of React, use `<SomeContext.Provider>`.

#### Props 

  * `value`: The value that you want to pass to all the components reading this context inside this provider, no matter how deep. The context value can be of any type. A component calling [`useContext(SomeContext)`](/reference/react/useContext) inside of the provider receives the `value` of the innermost corresponding context provider above it.



* * *

### `SomeContext.Consumer`

Before `useContext` existed, there was an older way to read context:
[code] 
    function Button() {  
    
    
      // 🟡 Legacy way (not recommended)  
    
    
      return (  
    
    
        <ThemeContext.Consumer>  
    
    
          {theme => (  
    
    
            <button className={theme} />  
    
    
          )}  
    
    
        </ThemeContext.Consumer>  
    
    
      );  
    
    
    }
[/code]

Although this older way still works, **newly written code should read context with[`useContext()`](/reference/react/useContext) instead:**
[code] 
    function Button() {  
    
    
      // ✅ Recommended way  
    
    
      const theme = useContext(ThemeContext);  
    
    
      return <button className={theme} />;  
    
    
    }
[/code]

#### Props 

  * `children`: A function. React will call the function you pass with the current context value determined by the same algorithm as [`useContext()`](/reference/react/useContext) does, and render the result you return from this function. React will also re-run this function and update the UI whenever the context from the parent components changes.



* * *

## Usage 

### Creating context 

Context lets components [pass information deep down](/learn/passing-data-deeply-with-context) without explicitly passing props.

Call `createContext` outside any components to create one or more contexts.
[code] 
    import { createContext } from 'react';  
    
    
      
    
    
    const ThemeContext = createContext('light');  
    
    
    const AuthContext = createContext(null);
[/code]

`createContext` returns a context object. Components can read context by passing it to [`useContext()`](/reference/react/useContext):
[code] 
    function Button() {  
    
    
      const theme = useContext(ThemeContext);  
    
    
      // ...  
    
    
    }  
    
    
      
    
    
    function Profile() {  
    
    
      const currentUser = useContext(AuthContext);  
    
    
      // ...  
    
    
    }
[/code]

By default, the values they receive will be the default values you have specified when creating the contexts. However, by itself this isn’t useful because the default values never change.

Context is useful because you can **provide other, dynamic values from your components:**
[code] 
    function App() {  
    
    
      const [theme, setTheme] = useState('dark');  
    
    
      const [currentUser, setCurrentUser] = useState({ name: 'Taylor' });  
    
    
      
    
    
      // ...  
    
    
      
    
    
      return (  
    
    
        <ThemeContext value={theme}>  
    
    
          <AuthContext value={currentUser}>  
    
    
            <Page />  
    
    
          </AuthContext>  
    
    
        </ThemeContext>  
    
    
      );  
    
    
    }
[/code]

Now the `Page` component and any components inside it, no matter how deep, will “see” the passed context values. If the passed context values change, React will re-render the components reading the context as well.

[Read more about reading and providing context and see examples.](/reference/react/useContext)

* * *

### Importing and exporting context from a file 

Often, components in different files will need access to the same context. This is why it’s common to declare contexts in a separate file. Then you can use the [`export` statement](https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/export) to make context available for other files:
[code] 
    // Contexts.js  
    
    
    import { createContext } from 'react';  
    
    
      
    
    
    export const ThemeContext = createContext('light');  
    
    
    export const AuthContext = createContext(null);
[/code]

Components declared in other files can then use the [`import`](https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/import) statement to read or provide this context:
[code] 
    // Button.js  
    
    
    import { ThemeContext } from './Contexts.js';  
    
    
      
    
    
    function Button() {  
    
    
      const theme = useContext(ThemeContext);  
    
    
      // ...  
    
    
    }
[/code]
[code] 
    // App.js  
    
    
    import { ThemeContext, AuthContext } from './Contexts.js';  
    
    
      
    
    
    function App() {  
    
    
      // ...  
    
    
      return (  
    
    
        <ThemeContext value={theme}>  
    
    
          <AuthContext value={currentUser}>  
    
    
            <Page />  
    
    
          </AuthContext>  
    
    
        </ThemeContext>  
    
    
      );  
    
    
    }
[/code]

This works similar to [importing and exporting components.](/learn/importing-and-exporting-components)

* * *

## Troubleshooting 

### I can’t find a way to change the context value 

Code like this specifies the _default_ context value:
[code] 
    const ThemeContext = createContext('light');
[/code]

This value never changes. React only uses this value as a fallback if it can’t find a matching provider above.

To make context change over time, [add state and wrap components in a context provider.](/reference/react/useContext#updating-data-passed-via-context)

[PreviouscaptureOwnerStack](/reference/react/captureOwnerStack)[Nextlazy](/reference/react/lazy)
