# Synthetic (M1 accept fixture: fences; no cursor line on purpose)

## 👤 User

What do role headings look like inside code?

## 🤖 Assistant

Inside fences they are plain content:

~~~markdown
## 🔧 Tool
## 👤 User
<!-- a comment -->
```
still inside the tilde fence
~~~

````text
```
a shorter backtick run does not close a longer fence
```
<details>
````

Done.
