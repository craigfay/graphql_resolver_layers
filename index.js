const express = require('express');
const { ApolloServer, gql, ForbiddenError, AuthenticationError } = require('apollo-server-express');
const jwt = require('jsonwebtoken');

// Defining a dummy "database"
const authors = [
  {
    id: 1,
    name: 'J.K. Rowling',
    username: 'jkrowling',
    password: 'password',
  },
  {
    name: 'Michael Chrichton',
    username: 'michaelcrichton',
    password: 'password',
  },
];
const books = [
  {
    id: 1,
    title: "Harry Potter and the Sorcerer's stone",
    authorId: 1,
  },
  {
    id: 2,
    title: 'Jurassic Park',
    authorId: 2,
  },
];


// Defining the GraphQL schema
const typeDefs = gql`
  type Query {
    book(id: Int): Book
    books: [Book]
    author(id: Int): Author
    authors: [Author]
    authenticate(credentials: AuthorCredentials): AuthenticationResult
  }
  type Author {
    id: Int
    name: String
    username: String
    password: String
  }
  type Book {
    id: Int
    title: String
    authorId: Int
  }
  input AuthorCredentials {
    username: String!
    password: String!
  }
  type AuthenticationResult {
    token: String
  }
`;

// Defining the default GraphQL resolvers, responsible only for using input
// to retrieve data.
const dataAccess = {
  Query: {
    authenticate: (parent, args, context, info) => {
      // finding an author that belongs to the given credentials
      const [author] = authors.filter(a => {
        return a.username == args.credentials.username
          && a.password == args.credentials.password
      });
      // signing an authentication token
      return { token: author ? jwt.sign(author, 'secret') : null }
    },
    books: (parent, args, context, info) => {
      return books;
    },
    book: (parent, args, context, info) => {
      return books.find(book => book.id == args.id);
    },
    authors: (parent, args, context, info) => {
      return authors;
    },
    author: (parent, args, context, info) => {
      return authors.find(author => author.id == args.id);
    },
  },
};

// Creating standard messages to show requesters
const accessDeniedMessage = 'You are not authorized to access this resource';
const unauthenticatedMessage = 'This resource requires an authentication token';


// Defining a resolver middleware layer that doesn't allow authors
// to access books that don't belong to them.
const denyAccessToUnownedBooks = previousLayers => ({
  Query: {
    books: (parent, args, context, info) => {
      if (!context.author) throw new AuthenticationError(unauthenticatedMessage);
      const results = previousLayers.Query.books(parent, args, context, info);
      return results.filter(book => book.authorId == context.author.id);
    },
    book: (parent, args, context, info) => {
      if (!context.author) throw new AuthenticationError(unauthenticatedMessage);
      if (args.id !== context.author.id) {
        throw new ForbiddenError(accessDeniedMessage);
      }
      return previousLayers.Query.book(parent, args, context, info);
    }
  }
});

// Defining a resolver middleware layer that hides sensitive fields.
const maskSensitiveFields = previousLayers => ({
  Query: {
    authors: (parent, args, context, info) => {
      const results = previousLayers.Query.authors(parent, args, context, info);
      return results.map(author => {
        return { ...author, password: '****' };
      })
    },
    author: (parent, args, context, info) => {
      const author = previousLayers.Query.author(parent, args, context, info);
      return { ...author, password: '****' }
    }
  }
});

// A helper function to combine resolver middleware layers.
function stackResolvers(layers) {
  return layers.reduce((stack, layer) => {
    return {
      Query: {
        ...stack.Query,
        ...layer(stack).Query,
      }
    }
  }, dataAccess);
}

// Defining the HTTP server
const app = express();

// Decoding authentication tokens, and making them available
// to downstream requests (and GraphQL context).
app.use(function(req, res, next) {
  const token = req.header('Token');
  if (token) {
    req.author = jwt.verify(token, 'secret');
  }
  next();
});

// Composing GraphQL behavior
const server = new ApolloServer({
  typeDefs,

  // Collapsing all sets of business rules into one set of resolvers
  resolvers: stackResolvers([
    maskSensitiveFields,
    denyAccessToUnownedBooks,
  ]),

  // Exposing GUI
  playground: true,

  // Making auth claims available in graphql context
  context: ({ req }) => {
    return { author: req.author };
  },
});

// Using GraphQL as Express middleware
server.applyMiddleware({ app });

// Starting the server
app.listen(9000, function() {
  console.log('listening on 9000!')
});
