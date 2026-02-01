[API Reference](/reference/react)

[Overview](/reference/rules)

# React calls Components and Hooks

React is responsible for rendering components and Hooks when necessary to optimize the user experience. It is declarative: you tell React what to render in your component’s logic, and React will figure out how best to display it to your user.

  * Never call component functions directly 
  * Never pass around Hooks as regular values 
    * Don’t dynamically mutate a Hook 
    * Don’t dynamically use Hooks 



* * *

## Never call component functions directly 

Components should only be used in JSX. Don’t call them as regular functions. React should call it.

React must decide when your component function is called [during rendering](/reference/rules/components-and-hooks-must-be-pure#how-does-react-run-your-code). In React, you do this using JSX.
[code] 
    function BlogPost() {  
    
    
      return <Layout><Article /></Layout>; // ✅ Good: Only use components in JSX  
    
    
    }
[/code]
[code] 
    function BlogPost() {  
    
    
      return <Layout>{Article()}</Layout>; // 🔴 Bad: Never call them directly  
    
    
    }
[/code]

If a component contains Hooks, it’s easy to violate the [Rules of Hooks](/reference/rules/rules-of-hooks) when components are called directly in a loop or conditionally.

Letting React orchestrate rendering also allows a number of benefits:

  * **Components become more than functions.** React can augment them with features like _local state_ through Hooks that are tied to the component’s identity in the tree.
  * **Component types participate in reconciliation.** By letting React call your components, you also tell it more about the conceptual structure of your tree. For example, when you move from rendering `<Feed>` to the `<Profile>` page, React won’t attempt to re-use them.
  * **React can enhance your user experience.** For example, it can let the browser do some work between component calls so that re-rendering a large component tree doesn’t block the main thread.
  * **A better debugging story.** If components are first-class citizens that the library is aware of, we can build rich developer tools for introspection in development.
  * **More efficient reconciliation.** React can decide exactly which components in the tree need re-rendering and skip over the ones that don’t. That makes your app faster and more snappy.



* * *

## Never pass around Hooks as regular values 

Hooks should only be called inside of components or Hooks. Never pass it around as a regular value.

Hooks allow you to augment a component with React features. They should always be called as a function, and never passed around as a regular value. This enables _local reasoning_ , or the ability for developers to understand everything a component can do by looking at that component in isolation.

Breaking this rule will cause React to not automatically optimize your component.

### Don’t dynamically mutate a Hook 

Hooks should be as “static” as possible. This means you shouldn’t dynamically mutate them. For example, this means you shouldn’t write higher order Hooks:
[code] 
    function ChatInput() {  
    
    
      const useDataWithLogging = withLogging(useData); // 🔴 Bad: don't write higher order Hooks  
    
    
      const data = useDataWithLogging();  
    
    
    }
[/code]

Hooks should be immutable and not be mutated. Instead of mutating a Hook dynamically, create a static version of the Hook with the desired functionality.
[code] 
    function ChatInput() {  
    
    
      const data = useDataWithLogging(); // ✅ Good: Create a new version of the Hook  
    
    
    }  
    
    
      
    
    
    function useDataWithLogging() {  
    
    
      // ... Create a new version of the Hook and inline the logic here  
    
    
    }
[/code]

### Don’t dynamically use Hooks 

Hooks should also not be dynamically used: for example, instead of doing dependency injection in a component by passing a Hook as a value:
[code] 
    function ChatInput() {  
    
    
      return <Button useData={useDataWithLogging} /> // 🔴 Bad: don't pass Hooks as props  
    
    
    }
[/code]

You should always inline the call of the Hook into that component and handle any logic in there.
[code] 
    function ChatInput() {  
    
    
      return <Button />  
    
    
    }  
    
    
      
    
    
    function Button() {  
    
    
      const data = useDataWithLogging(); // ✅ Good: Use the Hook directly  
    
    
    }  
    
    
      
    
    
    function useDataWithLogging() {  
    
    
      // If there's any conditional logic to change the Hook's behavior, it should be inlined into  
    
    
      // the Hook  
    
    
    }
[/code]

This way, `<Button />` is much easier to understand and debug. When Hooks are used in dynamic ways, it increases the complexity of your app greatly and inhibits local reasoning, making your team less productive in the long term. It also makes it easier to accidentally break the [Rules of Hooks](/reference/rules/rules-of-hooks) that Hooks should not be called conditionally. If you find yourself needing to mock components for tests, it’s better to mock the server instead to respond with canned data. If possible, it’s also usually more effective to test your app with end-to-end tests.

[PreviousComponents and Hooks must be pure](/reference/rules/components-and-hooks-must-be-pure)[NextRules of Hooks](/reference/rules/rules-of-hooks)
