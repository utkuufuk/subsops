# subops
Manages subscriber operations for [my blog](https://utkuufuk.com).

## Configuration
### Set Remote Configuration
```sh
firebase functions:config:set mailgun.api_key=<api_key>
firebase functions:config:set mailgun.domain=<domain>
firebase functions:config:set mailgun.email=<admin_email>
```

### Import Remote Configuration to Local Environment
```sh
firebase functions:config:get > functions/.runtimeconfig.json
```
