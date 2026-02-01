[API Reference](/reference/react)

[Lints](/reference/eslint-plugin-react-hooks)

# use-memo

Validates that the `useMemo` hook is used with a return value. See [`useMemo` docs](/reference/react/useMemo) for more information.

## Rule Details 

`useMemo` is for computing and caching expensive values, not for side effects. Without a return value, `useMemo` returns `undefined`, which defeats its purpose and likely indicates you’re using the wrong hook.

### Invalid 

Examples of incorrect code for this rule:
[code] 
    // ❌ No return value  
    
    
    function Component({ data }) {  
    
    
      const processed = useMemo(() => {  
    
    
        data.forEach(item => console.log(item));  
    
    
        // Missing return!  
    
    
      }, [data]);  
    
    
      
    
    
      return <div>{processed}</div>; // Always undefined  
    
    
    }
[/code]

### Valid 

Examples of correct code for this rule:
[code] 
    // ✅ Returns computed value  
    
    
    function Component({ data }) {  
    
    
      const processed = useMemo(() => {  
    
    
        return data.map(item => item * 2);  
    
    
      }, [data]);  
    
    
      
    
    
      return <div>{processed}</div>;  
    
    
    }
[/code]

## Troubleshooting 

### I need to run side effects when dependencies change 

You might try to use `useMemo` for side effects:
[code] 
    // ❌ Wrong: Side effects in useMemo  
    
    
    function Component({user}) {  
    
    
      // No return value, just side effect  
    
    
      useMemo(() => {  
    
    
        analytics.track('UserViewed', {userId: user.id});  
    
    
      }, [user.id]);  
    
    
      
    
    
      // Not assigned to a variable  
    
    
      useMemo(() => {  
    
    
        return analytics.track('UserViewed', {userId: user.id});  
    
    
      }, [user.id]);  
    
    
    }
[/code]

If the side effect needs to happen in response to user interaction, it’s best to colocate the side effect with the event:
[code] 
    // ✅ Good: Side effects in event handlers  
    
    
    function Component({user}) {  
    
    
      const handleClick = () => {  
    
    
        analytics.track('ButtonClicked', {userId: user.id});  
    
    
        // Other click logic...  
    
    
      };  
    
    
      
    
    
      return <button onClick={handleClick}>Click me</button>;  
    
    
    }
[/code]

If the side effect sychronizes React state with some external state (or vice versa), use `useEffect`:
[code] 
    // ✅ Good: Synchronization in useEffect  
    
    
    function Component({theme}) {  
    
    
      useEffect(() => {  
    
    
        localStorage.setItem('preferredTheme', theme);  
    
    
        document.body.className = theme;  
    
    
      }, [theme]);  
    
    
      
    
    
      return <div>Current theme: {theme}</div>;  
    
    
    }
[/code]

[Previousunsupported-syntax](/reference/eslint-plugin-react-hooks/lints/unsupported-syntax)
