[Learn React](/learn)

[Adding Interactivity](/learn/adding-interactivity)

# Updating Arrays in State

Arrays are mutable in JavaScript, but you should treat them as immutable when you store them in state. Just like with objects, when you want to update an array stored in state, you need to create a new one (or make a copy of an existing one), and then set state to use the new array.

### You will learn

  * How to add, remove, or change items in an array in React state
  * How to update an object inside of an array
  * How to make array copying less repetitive with Immer



## Updating arrays without mutation 

In JavaScript, arrays are just another kind of object. [Like with objects](/learn/updating-objects-in-state), **you should treat arrays in React state as read-only.** This means that you shouldn’t reassign items inside an array like `arr[0] = 'bird'`, and you also shouldn’t use methods that mutate the array, such as `push()` and `pop()`.

Instead, every time you want to update an array, you’ll want to pass a _new_ array to your state setting function. To do that, you can create a new array from the original array in your state by calling its non-mutating methods like `filter()` and `map()`. Then you can set your state to the resulting new array.

Here is a reference table of common array operations. When dealing with arrays inside React state, you will need to avoid the methods in the left column, and instead prefer the methods in the right column:

| avoid (mutates the array)| prefer (returns a new array)  
---|---|---  
adding| `push`, `unshift`| `concat`, `[...arr]` spread syntax (example)  
removing| `pop`, `shift`, `splice`| `filter`, `slice` (example)  
replacing| `splice`, `arr[i] = ...` assignment| `map` (example)  
sorting| `reverse`, `sort`| copy the array first (example)  
  
Alternatively, you can use Immer which lets you use methods from both columns.

### Pitfall

Unfortunately, [`slice`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice) and [`splice`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice) are named similarly but are very different:

  * `slice` lets you copy an array or a part of it.
  * `splice` **mutates** the array (to insert or delete items).



In React, you will be using `slice` (no `p`!) a lot more often because you don’t want to mutate objects or arrays in state. [Updating Objects](/learn/updating-objects-in-state) explains what mutation is and why it’s not recommended for state.

### Adding to an array 

`push()` will mutate an array, which you don’t want:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let nextId = 0;
    
    export default function List() {
      const [name, setName] = useState('');
      const [artists, setArtists] = useState([]);
    
      return (
        <>
          <h1>Inspiring sculptors:</h1>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button onClick={() => {
            artists.push({
              id: nextId++,
              name: name,
            });
          }}>Add</button>
          <ul>
            {artists.map(artist => (
              <li key={artist.id}>{artist.name}</li>
            ))}
          </ul>
        </>
      );
    }
    
    
[/code]

Show more

Instead, create a _new_ array which contains the existing items _and_ a new item at the end. There are multiple ways to do this, but the easiest one is to use the `...` [array spread](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#spread_in_array_literals) syntax:
[code] 
    setArtists( // Replace the state  
    
    
      [ // with a new array  
    
    
        ...artists, // that contains all the old items  
    
    
        { id: nextId++, name: name } // and one new item at the end  
    
    
      ]  
    
    
    );
[/code]

Now it works correctly:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let nextId = 0;
    
    export default function List() {
      const [name, setName] = useState('');
      const [artists, setArtists] = useState([]);
    
      return (
        <>
          <h1>Inspiring sculptors:</h1>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button onClick={() => {
            setArtists([
              ...artists,
              { id: nextId++, name: name }
            ]);
          }}>Add</button>
          <ul>
            {artists.map(artist => (
              <li key={artist.id}>{artist.name}</li>
            ))}
          </ul>
        </>
      );
    }
    
    
[/code]

Show more

The array spread syntax also lets you prepend an item by placing it _before_ the original `...artists`:
[code] 
    setArtists([  
    
    
      { id: nextId++, name: name },  
    
    
      ...artists // Put old items at the end  
    
    
    ]);
[/code]

In this way, spread can do the job of both `push()` by adding to the end of an array and `unshift()` by adding to the beginning of an array. Try it in the sandbox above!

### Removing from an array 

The easiest way to remove an item from an array is to _filter it out_. In other words, you will produce a new array that will not contain that item. To do this, use the `filter` method, for example:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let initialArtists = [
      { id: 0, name: 'Marta Colvin Andrade' },
      { id: 1, name: 'Lamidi Olonade Fakeye'},
      { id: 2, name: 'Louise Nevelson'},
    ];
    
    export default function List() {
      const [artists, setArtists] = useState(
        initialArtists
      );
    
      return (
        <>
          <h1>Inspiring sculptors:</h1>
          <ul>
            {artists.map(artist => (
              <li key={artist.id}>
                {artist.name}{' '}
                <button onClick={() => {
                  setArtists(
                    artists.filter(a =>
                      a.id !== artist.id
                    )
                  );
                }}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      );
    }
    
    
[/code]

Show more

Click the “Delete” button a few times, and look at its click handler.
[code] 
    setArtists(  
    
    
      artists.filter(a => a.id !== artist.id)  
    
    
    );
[/code]

Here, `artists.filter(a => a.id !== artist.id)` means “create an array that consists of those `artists` whose IDs are different from `artist.id`”. In other words, each artist’s “Delete” button will filter _that_ artist out of the array, and then request a re-render with the resulting array. Note that `filter` does not modify the original array.

### Transforming an array 

If you want to change some or all items of the array, you can use `map()` to create a **new** array. The function you will pass to `map` can decide what to do with each item, based on its data or its index (or both).

In this example, an array holds coordinates of two circles and a square. When you press the button, it moves only the circles down by 50 pixels. It does this by producing a new array of data using `map()`:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let initialShapes = [
      { id: 0, type: 'circle', x: 50, y: 100 },
      { id: 1, type: 'square', x: 150, y: 100 },
      { id: 2, type: 'circle', x: 250, y: 100 },
    ];
    
    export default function ShapeEditor() {
      const [shapes, setShapes] = useState(
        initialShapes
      );
    
      function handleClick() {
        const nextShapes = shapes.map(shape => {
          if (shape.type === 'square') {
            // No change
            return shape;
          } else {
            // Return a new circle 50px below
            return {
              ...shape,
              y: shape.y + 50,
            };
          }
        });
        // Re-render with the new array
        setShapes(nextShapes);
      }
    
      return (
        <>
          <button onClick={handleClick}>
            Move circles down!
          </button>
          {shapes.map(shape => (
            <div
              key={shape.id}
              style={{
              background: 'purple',
              position: 'absolute',
              left: shape.x,
              top: shape.y,
              borderRadius:
                shape.type === 'circle'
                  ? '50%' : '',
              width: 20,
              height: 20,
            }} />
          ))}
        </>
      );
    }
    
    
[/code]

Show more

### Replacing items in an array 

It is particularly common to want to replace one or more items in an array. Assignments like `arr[0] = 'bird'` are mutating the original array, so instead you’ll want to use `map` for this as well.

To replace an item, create a new array with `map`. Inside your `map` call, you will receive the item index as the second argument. Use it to decide whether to return the original item (the first argument) or something else:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let initialCounters = [
      0, 0, 0
    ];
    
    export default function CounterList() {
      const [counters, setCounters] = useState(
        initialCounters
      );
    
      function handleIncrementClick(index) {
        const nextCounters = counters.map((c, i) => {
          if (i === index) {
            // Increment the clicked counter
            return c + 1;
          } else {
            // The rest haven't changed
            return c;
          }
        });
        setCounters(nextCounters);
      }
    
      return (
        <ul>
          {counters.map((counter, i) => (
            <li key={i}>
              {counter}
              <button onClick={() => {
                handleIncrementClick(i);
              }}>+1</button>
            </li>
          ))}
        </ul>
      );
    }
    
    
[/code]

Show more

### Inserting into an array 

Sometimes, you may want to insert an item at a particular position that’s neither at the beginning nor at the end. To do this, you can use the `...` array spread syntax together with the `slice()` method. The `slice()` method lets you cut a “slice” of the array. To insert an item, you will create an array that spreads the slice _before_ the insertion point, then the new item, and then the rest of the original array.

In this example, the Insert button always inserts at the index `1`:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let nextId = 3;
    const initialArtists = [
      { id: 0, name: 'Marta Colvin Andrade' },
      { id: 1, name: 'Lamidi Olonade Fakeye'},
      { id: 2, name: 'Louise Nevelson'},
    ];
    
    export default function List() {
      const [name, setName] = useState('');
      const [artists, setArtists] = useState(
        initialArtists
      );
    
      function handleClick() {
        const insertAt = 1; // Could be any index
        const nextArtists = [
          // Items before the insertion point:
          ...artists.slice(0, insertAt),
          // New item:
          { id: nextId++, name: name },
          // Items after the insertion point:
          ...artists.slice(insertAt)
        ];
        setArtists(nextArtists);
        setName('');
      }
    
      return (
        <>
          <h1>Inspiring sculptors:</h1>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button onClick={handleClick}>
            Insert
          </button>
          <ul>
            {artists.map(artist => (
              <li key={artist.id}>{artist.name}</li>
            ))}
          </ul>
        </>
      );
    }
    
    
[/code]

Show more

### Making other changes to an array 

There are some things you can’t do with the spread syntax and non-mutating methods like `map()` and `filter()` alone. For example, you may want to reverse or sort an array. The JavaScript `reverse()` and `sort()` methods are mutating the original array, so you can’t use them directly.

**However, you can copy the array first, and then make changes to it.**

For example:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    const initialList = [
      { id: 0, title: 'Big Bellies' },
      { id: 1, title: 'Lunar Landscape' },
      { id: 2, title: 'Terracotta Army' },
    ];
    
    export default function List() {
      const [list, setList] = useState(initialList);
    
      function handleClick() {
        const nextList = [...list];
        nextList.reverse();
        setList(nextList);
      }
    
      return (
        <>
          <button onClick={handleClick}>
            Reverse
          </button>
          <ul>
            {list.map(artwork => (
              <li key={artwork.id}>{artwork.title}</li>
            ))}
          </ul>
        </>
      );
    }
    
    
[/code]

Show more

Here, you use the `[...list]` spread syntax to create a copy of the original array first. Now that you have a copy, you can use mutating methods like `nextList.reverse()` or `nextList.sort()`, or even assign individual items with `nextList[0] = "something"`.

However, **even if you copy an array, you can’t mutate existing items _inside_ of it directly.** This is because copying is shallow—the new array will contain the same items as the original one. So if you modify an object inside the copied array, you are mutating the existing state. For example, code like this is a problem.
[code] 
    const nextList = [...list];  
    
    
    nextList[0].seen = true; // Problem: mutates list[0]  
    
    
    setList(nextList);
[/code]

Although `nextList` and `list` are two different arrays, **`nextList[0]` and `list[0]` point to the same object.** So by changing `nextList[0].seen`, you are also changing `list[0].seen`. This is a state mutation, which you should avoid! You can solve this issue in a similar way to [updating nested JavaScript objects](/learn/updating-objects-in-state#updating-a-nested-object)—by copying individual items you want to change instead of mutating them. Here’s how.

## Updating objects inside arrays 

Objects are not _really_ located “inside” arrays. They might appear to be “inside” in code, but each object in an array is a separate value, to which the array “points”. This is why you need to be careful when changing nested fields like `list[0]`. Another person’s artwork list may point to the same element of the array!

**When updating nested state, you need to create copies from the point where you want to update, and all the way up to the top level.** Let’s see how this works.

In this example, two separate artwork lists have the same initial state. They are supposed to be isolated, but because of a mutation, their state is accidentally shared, and checking a box in one list affects the other list:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let nextId = 3;
    const initialList = [
      { id: 0, title: 'Big Bellies', seen: false },
      { id: 1, title: 'Lunar Landscape', seen: false },
      { id: 2, title: 'Terracotta Army', seen: true },
    ];
    
    export default function BucketList() {
      const [myList, setMyList] = useState(initialList);
      const [yourList, setYourList] = useState(
        initialList
      );
    
      function handleToggleMyList(artworkId, nextSeen) {
        const myNextList = [...myList];
        const artwork = myNextList.find(
          a => a.id === artworkId
        );
        artwork.seen = nextSeen;
        setMyList(myNextList);
      }
    
      function handleToggleYourList(artworkId, nextSeen) {
        const yourNextList = [...yourList];
        const artwork = yourNextList.find(
          a => a.id === artworkId
        );
        artwork.seen = nextSeen;
        setYourList(yourNextList);
      }
    
      return (
        <>
          <h1>Art Bucket List</h1>
          <h2>My list of art to see:</h2>
          <ItemList
            artworks={myList}
            onToggle={handleToggleMyList} />
          <h2>Your list of art to see:</h2>
          <ItemList
            artworks={yourList}
            onToggle={handleToggleYourList} />
        </>
      );
    }
    
    function ItemList({ artworks, onToggle }) {
      return (
        <ul>
          {artworks.map(artwork => (
            <li key={artwork.id}>
              <label>
                <input
                  type="checkbox"
                  checked={artwork.seen}
                  onChange={e => {
                    onToggle(
                      artwork.id,
                      e.target.checked
                    );
                  }}
                />
                {artwork.title}
              </label>
            </li>
          ))}
        </ul>
      );
    }
    
    
[/code]

Show more

The problem is in code like this:
[code] 
    const myNextList = [...myList];  
    
    
    const artwork = myNextList.find(a => a.id === artworkId);  
    
    
    artwork.seen = nextSeen; // Problem: mutates an existing item  
    
    
    setMyList(myNextList);
[/code]

Although the `myNextList` array itself is new, the _items themselves_ are the same as in the original `myList` array. So changing `artwork.seen` changes the _original_ artwork item. That artwork item is also in `yourList`, which causes the bug. Bugs like this can be difficult to think about, but thankfully they disappear if you avoid mutating state.

**You can use`map` to substitute an old item with its updated version without mutation.**
[code] 
    setMyList(myList.map(artwork => {  
    
    
      if (artwork.id === artworkId) {  
    
    
        // Create a *new* object with changes  
    
    
        return { ...artwork, seen: nextSeen };  
    
    
      } else {  
    
    
        // No changes  
    
    
        return artwork;  
    
    
      }  
    
    
    }));
[/code]

Here, `...` is the object spread syntax used to [create a copy of an object.](/learn/updating-objects-in-state#copying-objects-with-the-spread-syntax)

With this approach, none of the existing state items are being mutated, and the bug is fixed:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    let nextId = 3;
    const initialList = [
      { id: 0, title: 'Big Bellies', seen: false },
      { id: 1, title: 'Lunar Landscape', seen: false },
      { id: 2, title: 'Terracotta Army', seen: true },
    ];
    
    export default function BucketList() {
      const [myList, setMyList] = useState(initialList);
      const [yourList, setYourList] = useState(
        initialList
      );
    
      function handleToggleMyList(artworkId, nextSeen) {
        setMyList(myList.map(artwork => {
          if (artwork.id === artworkId) {
            // Create a *new* object with changes
            return { ...artwork, seen: nextSeen };
          } else {
            // No changes
            return artwork;
          }
        }));
      }
    
      function handleToggleYourList(artworkId, nextSeen) {
        setYourList(yourList.map(artwork => {
          if (artwork.id === artworkId) {
            // Create a *new* object with changes
            return { ...artwork, seen: nextSeen };
          } else {
            // No changes
            return artwork;
          }
        }));
      }
    
      return (
        <>
          <h1>Art Bucket List</h1>
          <h2>My list of art to see:</h2>
          <ItemList
            artworks={myList}
            onToggle={handleToggleMyList} />
          <h2>Your list of art to see:</h2>
          <ItemList
            artworks={yourList}
            onToggle={handleToggleYourList} />
        </>
      );
    }
    
    function ItemList({ artworks, onToggle }) {
      return (
        <ul>
          {artworks.map(artwork => (
            <li key={artwork.id}>
              <label>
                <input
                  type="checkbox"
                  checked={artwork.seen}
                  onChange={e => {
                    onToggle(
                      artwork.id,
                      e.target.checked
                    );
                  }}
                />
                {artwork.title}
              </label>
            </li>
          ))}
        </ul>
      );
    }
    
    
[/code]

Show more

In general, **you should only mutate objects that you have just created.** If you were inserting a _new_ artwork, you could mutate it, but if you’re dealing with something that’s already in state, you need to make a copy.

### Write concise update logic with Immer 

Updating nested arrays without mutation can get a little bit repetitive. [Just as with objects](/learn/updating-objects-in-state#write-concise-update-logic-with-immer):

  * Generally, you shouldn’t need to update state more than a couple of levels deep. If your state objects are very deep, you might want to [restructure them differently](/learn/choosing-the-state-structure#avoid-deeply-nested-state) so that they are flat.
  * If you don’t want to change your state structure, you might prefer to use [Immer](https://github.com/immerjs/use-immer), which lets you write using the convenient but mutating syntax and takes care of producing the copies for you.



Here is the Art Bucket List example rewritten with Immer:

package.jsonApp.js

package.json

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    {
      "dependencies": {
        "immer": "1.7.3",
        "react": "latest",
        "react-dom": "latest",
        "react-scripts": "latest",
        "use-immer": "0.5.1"
      },
      "scripts": {
        "start": "react-scripts start",
        "build": "react-scripts build",
        "test": "react-scripts test --env=jsdom",
        "eject": "react-scripts eject"
      },
      "devDependencies": {}
    }
[/code]

Note how with Immer, **mutation like`artwork.seen = nextSeen` is now okay:**
[code] 
    updateMyTodos(draft => {  
    
    
      const artwork = draft.find(a => a.id === artworkId);  
    
    
      artwork.seen = nextSeen;  
    
    
    });
[/code]

This is because you’re not mutating the _original_ state, but you’re mutating a special `draft` object provided by Immer. Similarly, you can apply mutating methods like `push()` and `pop()` to the content of the `draft`.

Behind the scenes, Immer always constructs the next state from scratch according to the changes that you’ve done to the `draft`. This keeps your event handlers very concise without ever mutating state.

## Recap

  * You can put arrays into state, but you can’t change them.
  * Instead of mutating an array, create a _new_ version of it, and update the state to it.
  * You can use the `[...arr, newItem]` array spread syntax to create arrays with new items.
  * You can use `filter()` and `map()` to create new arrays with filtered or transformed items.
  * You can use Immer to keep your code concise.



## Try out some challenges

1. Update an item in the shopping cart 2. Remove an item from the shopping cart 3. Fix the mutations using non-mutative methods 4. Fix the mutations using Immer 

#### 

Challenge 1 of 4: 

Update an item in the shopping cart 

Fill in the `handleIncreaseClick` logic so that pressing ”+” increases the corresponding number:

App.js

App.js

ReloadClear[Fork](https://codesandbox.io/api/v1/sandboxes/define?undefined&environment=create-react-app "Open in CodeSandbox")
[code]
    import { useState } from 'react';
    
    const initialProducts = [{
      id: 0,
      name: 'Baklava',
      count: 1,
    }, {
      id: 1,
      name: 'Cheese',
      count: 5,
    }, {
      id: 2,
      name: 'Spaghetti',
      count: 2,
    }];
    
    export default function ShoppingCart() {
      const [
        products,
        setProducts
      ] = useState(initialProducts)
    
      function handleIncreaseClick(productId) {
    
      }
    
      return (
        <ul>
          {products.map(product => (
            <li key={product.id}>
              {product.name}
              {' '}
              (<b>{product.count}</b>)
              <button onClick={() => {
                handleIncreaseClick(product.id);
              }}>
                +
              </button>
            </li>
          ))}
        </ul>
      );
    }
    
    
[/code]

Show more

Show solutionNext Challenge

[PreviousUpdating Objects in State](/learn/updating-objects-in-state)[NextManaging State](/learn/managing-state)
