// Source-review fixture, not a standalone app. Backend policies decide access.
Future<dynamic> readNote(dynamic client, String id) =>
    client.from("notes").select("body").eq("id", id);
