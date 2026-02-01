[API Reference](/reference/react)

[Overview](/reference/rules)

# Rules of Hooks

Hooks are defined using JavaScript functions, but they represent a special type of reusable UI logic with restrictions on where they can be called.

  * Only call Hooks at the top level 
  * Only call Hooks from React functions 



* * *

## Only call Hooks at the top level 

Functions whose names start with `use` are called [_Hooks_](/reference/react) in React.

**Don’t call Hooks inside loops, conditions, nested functions, or`try`/`catch`/`finally` blocks.** Instead, always use Hooks at the top level of your React function, before any early returns. You can only call Hooks while React is rendering a function component:

  * ✅ Call them at the top level in the body of a [function component](/learn/your-first-component).
  * ✅ Call them at the top level in the body of a [custom Hook](/learn/reusing-logic-with-custom-hooks).


[code] 
    function Counter() {  
    
    
      // ✅ Good: top-level in a function component  
    
    
      const [count, setCount] = useState(0);  
    
    
      // ...  
    
    
    }  
    
    
      
    
    
    function useWindowWidth() {  
    
    
      // ✅ Good: top-level in a custom Hook  
    
    
      const [width, setWidth] = useState(window.innerWidth);  
    
    
      // ...  
    
    
    }
[/code]

It’s **not** supported to call Hooks (functions starting with `use`) in any other cases, for example:

  * 🔴 Do not call Hooks inside conditions or loops.
  * 🔴 Do not call Hooks after a conditional `return` statement.
  * 🔴 Do not call Hooks in event handlers.
  * 🔴 Do not call Hooks in class components.
  * 🔴 Do not call Hooks inside functions passed to `useMemo`, `useReducer`, or `useEffect`.
  * 🔴 Do not call Hooks inside `try`/`catch`/`finally` blocks.



If you break these rules, you might see this error.
[code] 
    function Bad({ cond }) {  
    
    
      if (cond) {  
    
    
        // 🔴 Bad: inside a condition (to fix, move it outside!)  
    
    
        const theme = useContext(ThemeContext);  
    
    
      }  
    
    
      // ...  
    
    
    }  
    
    
      
    
    
    function Bad() {  
    
    
      for (let i = 0; i < 10; i++) {  
    
    
        // 🔴 Bad: inside a loop (to fix, move it outside!)  
    
    
        const theme = useContext(ThemeContext);  
    
    
      }  
    
    
      // ...  
    
    
    }  
    
    
      
    
    
    function Bad({ cond }) {  
    
    
      if (cond) {  
    
    
        return;  
    
    
      }  
    
    
      // 🔴 Bad: after a conditional return (to fix, move it before the return!)  
    
    
      const theme = useContext(ThemeContext);  
    
    
      // ...  
    
    
    }  
    
    
      
    
    
    function Bad() {  
    
    
      function handleClick() {  
    
    
        // 🔴 Bad: inside an event handler (to fix, move it outside!)  
    
    
        const theme = useContext(ThemeContext);  
    
    
      }  
    
    
      // ...  
    
    
    }  
    
    
      
    
    
    function Bad() {  
    
    
      const style = useMemo(() => {  
    
    
        // 🔴 Bad: inside useMemo (to fix, move it outside!)  
    
    
        const theme = useContext(ThemeContext);  
    
    
        return createStyle(theme);  
    
    
      });  
    
    
      // ...  
    
    
    }  
    
    
      
    
    
    class Bad extends React.Component {  
    
    
      render() {  
    
    
        // 🔴 Bad: inside a class component (to fix, write a function component instead of a class!)  
    
    
        useEffect(() => {})  
    
    
        // ...  
    
    
      }  
    
    
    }  
    
    
      
    
    
    function Bad() {  
    
    
      try {  
    
    
        // 🔴 Bad: inside try/catch/finally block (to fix, move it outside!)  
    
    
        const [x, setX] = useState(0);  
    
    
      } catch {  
    
    
        const [x, setX] = useState(1);  
    
    
      }  
    
    
    }
[/code]

You can use the [`eslint-plugin-react-hooks` plugin](https://www.npmjs.com/package/eslint-plugin-react-hooks) to catch these mistakes.

### Note

[Custom Hooks](/learn/reusing-logic-with-custom-hooks) _may_ call other Hooks (that’s their whole purpose). This works because custom Hooks are also supposed to only be called while a function component is rendering.

* * *

## Only call Hooks from React functions 

Don’t call Hooks from regular JavaScript functions. Instead, you can:

✅ Call Hooks from React function components. ✅ Call Hooks from [custom Hooks](/learn/reusing-logic-with-custom-hooks#extracting-your-own-custom-hook-from-a-component).

By following this rule, you ensure that all stateful logic in a component is clearly visible from its source code.
[code] 
    function FriendList() {  
    
    
      const [onlineStatus, setOnlineStatus] = useOnlineStatus(); // ✅  
    
    
    }  
    
    
      
    
    
    function setOnlineStatus() { // ❌ Not a component or custom Hook!  
    
    
      const [onlineStatus, setOnlineStatus] = useOnlineStatus();  
    
    
    }
[/code]

[PreviousReact calls Components and Hooks](/reference/rules/react-calls-components-and-hooks)
