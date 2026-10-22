// Source-review fixture. The client filter is not an authorization boundary.
export const readNote = (client: any, id: string) => client.from("notes").select("body").eq("id", id);
