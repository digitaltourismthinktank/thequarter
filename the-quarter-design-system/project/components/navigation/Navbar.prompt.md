Marketing-site top navigation. Pass the real wordmark via `logoSrc`. Use `variant="dark"` over a hero image (it inverts the black wordmark to white and uses light text); `light` is the solid cream bar with blur.

```jsx
<Navbar
  logoSrc="../../assets/logo-wordmark-black.png"
  variant="dark"
  activeHref="/spaces"
  links={[{label:'The Spaces',href:'/spaces'},{label:'Plans',href:'/plans'},{label:'Meeting rooms',href:'/rooms'},{label:'Perks',href:'/perks'}]}
  onNavigate={(href)=>go(href)}
/>
```
