[Learn React](/learn)

[Describing the UI](/learn/describing-the-ui)

# JavaScript in JSX with Curly Braces

JSX lets you write HTML-like markup inside a JavaScript file, keeping rendering logic and content in the same place. Sometimes you will want to add a little JavaScript logic or reference a dynamic property inside that markup. In this situation, you can use curly braces in your JSX to open a window to JavaScript.

### You will learn

  * How to pass strings with quotes
  * How to reference a JavaScript variable inside JSX with curly braces
  * How to call a JavaScript function inside JSX with curly braces
  * How to use a JavaScript object inside JSX with curly braces



## Passing strings with quotes 

When you want to pass a string attribute to JSX, you put it in single or double quotes:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    export default function Avatar() {
      return (
        <img
          className="avatar"
          src="https://i.imgur.com/7vQD0fPs.jpg"
          alt="Gregorio Y. Zara"
        />
      );
    }
    
    
[/code]

Here, `"https://i.imgur.com/7vQD0fPs.jpg"` and `"Gregorio Y. Zara"` are being passed as strings.

But what if you want to dynamically specify the `src` or `alt` text? You could **use a value from JavaScript by replacing`"` and `"` with `{` and `}`**:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    export default function Avatar() {
      const avatar = 'https://i.imgur.com/7vQD0fPs.jpg';
      const description = 'Gregorio Y. Zara';
      return (
        <img
          className="avatar"
          src={avatar}
          alt={description}
        />
      );
    }
    
    
[/code]

Notice the difference between `className="avatar"`, which specifies an `"avatar"` CSS class name that makes the image round, and `src={avatar}` that reads the value of the JavaScript variable called `avatar`. That’s because curly braces let you work with JavaScript right there in your markup!

## Using curly braces: A window into the JavaScript world 

JSX is a special way of writing JavaScript. That means it’s possible to use JavaScript inside it—with curly braces `{ }`. The example below first declares a name for the scientist, `name`, then embeds it with curly braces inside the `<h1>`:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    export default function TodoList() {
      const name = 'Gregorio Y. Zara';
      return (
        <h1>{name}'s To Do List</h1>
      );
    }
    
    
[/code]

Try changing the `name`’s value from `'Gregorio Y. Zara'` to `'Hedy Lamarr'`. See how the list title changes?

Any JavaScript expression will work between curly braces, including function calls like `formatDate()`:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    const today = new Date();
    
    function formatDate(date) {
      return new Intl.DateTimeFormat(
        'en-US',
        { weekday: 'long' }
      ).format(date);
    }
    
    export default function TodoList() {
      return (
        <h1>To Do List for {formatDate(today)}</h1>
      );
    }
    
    
[/code]

### Where to use curly braces 

You can only use curly braces in two ways inside JSX:

  1. **As text** directly inside a JSX tag: `<h1>{name}'s To Do List</h1>` works, but `<{tag}>Gregorio Y. Zara's To Do List</{tag}>` will not.
  2. **As attributes** immediately following the `=` sign: `src={avatar}` will read the `avatar` variable, but `src="{avatar}"` will pass the string `"{avatar}"`.



## Using “double curlies”: CSS and other objects in JSX 

In addition to strings, numbers, and other JavaScript expressions, you can even pass objects in JSX. Objects are also denoted with curly braces, like `{ name: "Hedy Lamarr", inventions: 5 }`. Therefore, to pass a JS object in JSX, you must wrap the object in another pair of curly braces: `person={{ name: "Hedy Lamarr", inventions: 5 }}`.

You may see this with inline CSS styles in JSX. React does not require you to use inline styles (CSS classes work great for most cases). But when you need an inline style, you pass an object to the `style` attribute:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    export default function TodoList() {
      return (
        <ul style={{
          backgroundColor: 'black',
          color: 'pink'
        }}>
          <li>Improve the videophone</li>
          <li>Prepare aeronautics lectures</li>
          <li>Work on the alcohol-fuelled engine</li>
        </ul>
      );
    }
    
    
[/code]

Try changing the values of `backgroundColor` and `color`.

You can really see the JavaScript object inside the curly braces when you write it like this:
[code] 
    <ul style={  
    
    
      {  
    
    
        backgroundColor: 'black',  
    
    
        color: 'pink'  
    
    
      }  
    
    
    }>
[/code]

The next time you see `{{` and `}}` in JSX, know that it’s nothing more than an object inside the JSX curlies!

### Pitfall

Inline `style` properties are written in camelCase. For example, HTML `<ul style="background-color: black">` would be written as `<ul style={{ backgroundColor: 'black' }}>` in your component.

## More fun with JavaScript objects and curly braces 

You can move several expressions into one object, and reference them in your JSX inside curly braces:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    const person = {
      name: 'Gregorio Y. Zara',
      theme: {
        backgroundColor: 'black',
        color: 'pink'
      }
    };
    
    export default function TodoList() {
      return (
        <div style={person.theme}>
          <h1>{person.name}'s Todos</h1>
          <img
            className="avatar"
            src="https://i.imgur.com/7vQD0fPs.jpg"
            alt="Gregorio Y. Zara"
          />
          <ul>
            <li>Improve the videophone</li>
            <li>Prepare aeronautics lectures</li>
            <li>Work on the alcohol-fuelled engine</li>
          </ul>
        </div>
      );
    }
    
    
[/code]

Show more

In this example, the `person` JavaScript object contains a `name` string and a `theme` object:
[code] 
    const person = {  
    
    
      name: 'Gregorio Y. Zara',  
    
    
      theme: {  
    
    
        backgroundColor: 'black',  
    
    
        color: 'pink'  
    
    
      }  
    
    
    };
[/code]

The component can use these values from `person` like so:
[code] 
    <div style={person.theme}>  
    
    
      <h1>{person.name}'s Todos</h1>
[/code]

JSX is very minimal as a templating language because it lets you organize data and logic using JavaScript.

## Recap

Now you know almost everything about JSX:

  * JSX attributes inside quotes are passed as strings.
  * Curly braces let you bring JavaScript logic and variables into your markup.
  * They work inside the JSX tag content or immediately after `=` in attributes.
  * `{{` and `}}` is not special syntax: it’s a JavaScript object tucked inside JSX curly braces.



## Try out some challenges

1. Fix the mistake 2. Extract information into an object 3. Write an expression inside JSX curly braces 

#### 

Challenge 1 of 3: 

Fix the mistake 

This code crashes with an error saying `Objects are not valid as a React child`:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    const person = {
      name: 'Gregorio Y. Zara',
      theme: {
        backgroundColor: 'black',
        color: 'pink'
      }
    };
    
    export default function TodoList() {
      return (
        <div style={person.theme}>
          <h1>{person}'s Todos</h1>
          <img
            className="avatar"
            src="https://i.imgur.com/7vQD0fPs.jpg"
            alt="Gregorio Y. Zara"
          />
          <ul>
            <li>Improve the videophone</li>
            <li>Prepare aeronautics lectures</li>
            <li>Work on the alcohol-fuelled engine</li>
          </ul>
        </div>
      );
    }
    
    
[/code]

Show more

Can you find the problem?

Show hint Show solution

Next Challenge

[PreviousWriting Markup with JSX](/learn/writing-markup-with-jsx)[NextPassing Props to a Component](/learn/passing-props-to-a-component)
