# OpenAPI

The API uses consistent response envelopes:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "TASK_ALREADY_CLAIMED",
    "message": "This task has already been grabbed by another Scanner.",
    "details": null
  },
  "meta": {
    "requestId": "..."
  }
}
```

Route inventory is maintained in `README.md`. A generated OpenAPI JSON route is not yet wired.
