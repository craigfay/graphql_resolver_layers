# About

GraphQL APIs are notoriously difficult to access-control, in part because their surface area is much larger than traditional HTTP API surfaces.

One way to overcome this problem is by separating your resolvers into **multiple layers**. Consider the following layers:

* **Data Access Layer**: The last layer that gets triggered. Purely responsible for using the client's input to fetch results from the database, or wherever it happens to be stored.

* **Omission Layers**: Responsible for inspecting the result that would be returned by previous layers, and and manipulating it to prevent the user from seeing anything they shouldn't, like sensitive fields, or records that don't belong to the requester. This is different than Authorization, because the requester hasn't done anything wrong.

* **Demand Control Layer**: Devises a mechanism for tracking the "cost" of each request, and responds negatively if the requester exceeds their "demand allowance".

* **Authorization Layer**: Determines whether a requester is allowed to interact with resources, based on the operations they chose, and the parameters they provided. It's very reasonable to separate authorization into multiple layers, each representing a "business policy".

* **Authentication Layer**: Stops other layers from being reached if the requester hasn't properly identified themselves.


The demands of each API will be different, but using resolver layers will almost always help keep concerns separated, and code organized.

See `index.js` for a minimal example of how one might implement resolver layers.