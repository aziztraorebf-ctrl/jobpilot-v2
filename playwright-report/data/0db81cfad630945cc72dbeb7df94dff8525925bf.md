# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img [ref=e6]
        - generic [ref=e9]: JobPilot
      - generic [ref=e10]: Se connecter
      - generic [ref=e11]: Connectez-vous pour acceder a votre espace
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]: Courriel
        - textbox "Courriel" [ref=e16]: test@jobpilot.dev
      - generic [ref=e17]:
        - generic [ref=e18]: Mot de passe
        - textbox "Mot de passe" [ref=e19]: test123
      - paragraph [ref=e20]: Courriel ou mot de passe invalide
      - button "Se connecter" [ref=e21]
      - paragraph [ref=e22]:
        - text: Pas encore de compte ?
        - link "Creer un compte" [ref=e23] [cursor=pointer]:
          - /url: /fr/signup
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e29] [cursor=pointer]:
    - img [ref=e30]
  - alert [ref=e33]
```