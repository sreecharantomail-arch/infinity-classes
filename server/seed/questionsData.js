export const defaultQuestions = [
  {
    questionText: 'Which of the following is true about React state updates?',
    options: [
      'State updates are always synchronous',
      'State updates may be batched and are asynchronous',
      'State can be directly mutated using this.state = ... in functional components',
      'State updates do not trigger component re-renders'
    ],
    correctOptionIndex: 1,
    category: 'React & Frontend',
    difficulty: 'medium',
    explanation: 'React batches state updates together for better rendering performance, so state updates are processed asynchronously.'
  },
  {
    questionText: 'What is the role of the "next" function in Express.js middleware?',
    options: [
      'It sends the response immediately back to the client',
      'It passes control to the next middleware or route handler in the stack',
      'It restarts the Express application server',
      'It redirects the request to the home page'
    ],
    correctOptionIndex: 1,
    category: 'Node.js & Express',
    difficulty: 'easy',
    explanation: 'In Express, calling next() invokes the next middleware function in the execution stack.'
  },
  {
    questionText: 'In MongoDB, which method is used to find a single document that matches a specified condition?',
    options: [
      'db.collection.selectOne()',
      'db.collection.findOne()',
      'db.collection.querySingle()',
      'db.collection.searchOne()'
    ],
    correctOptionIndex: 1,
    category: 'MongoDB & Databases',
    difficulty: 'easy',
    explanation: 'findOne() returns one document that satisfies the specified query criteria in MongoDB.'
  },
  {
    questionText: 'What does the useEffect hook with an empty dependency array `[]` represent in React?',
    options: [
      'It executes on every render cycle',
      'It runs only once after the initial component mount',
      'It causes an infinite loop',
      'It runs only right before the component unmounts'
    ],
    correctOptionIndex: 1,
    category: 'React & Frontend',
    difficulty: 'easy',
    explanation: 'An empty dependency array tells React to execute the effect callback only once when the component is initially mounted.'
  },
  {
    questionText: 'Which HTTP status code signifies that the client is unauthorized to view or access a resource?',
    options: [
      '200 OK',
      '401 Unauthorized',
      '404 Not Found',
      '500 Internal Server Error'
    ],
    correctOptionIndex: 1,
    category: 'Web Development & APIs',
    difficulty: 'easy',
    explanation: 'HTTP 401 Unauthorized indicates that the request requires HTTP authentication or the credentials provided are invalid.'
  },
  {
    questionText: 'In Node.js, what is the Event Loop responsible for?',
    options: [
      'Compiling JavaScript into machine bytecode ahead of time',
      'Handling non-blocking, asynchronous I/O operations in a single-threaded runtime',
      'Managing CSS animations and styles in web browsers',
      'Encrypting passwords using multi-threading'
    ],
    correctOptionIndex: 1,
    category: 'Node.js & Express',
    difficulty: 'medium',
    explanation: 'The event loop allows Node.js to perform non-blocking I/O operations despite JavaScript being single-threaded by offloading tasks to the system kernel whenever possible.'
  },
  {
    questionText: 'What is the primary difference between SQL and NoSQL databases like MongoDB?',
    options: [
      'SQL databases do not support primary keys',
      'MongoDB stores data in flexible, JSON-like document format rather than rigid relational tables',
      'NoSQL databases cannot store numbers or text',
      'SQL databases do not require any schema'
    ],
    correctOptionIndex: 1,
    category: 'MongoDB & Databases',
    difficulty: 'easy',
    explanation: 'MongoDB is a document-oriented database that stores records as BSON (binary JSON) documents with dynamic schemas, unlike relational tables.'
  },
  {
    questionText: 'Why should passwords never be stored in plain text in a database?',
    options: [
      'Plain text passwords take up more storage space',
      'If the database is compromised, user credentials would be exposed directly without protection',
      'MongoDB throws a syntax error if plain text is inserted',
      'Plain text passwords cannot be queried with indexes'
    ],
    correctOptionIndex: 1,
    category: 'Security & Auth',
    difficulty: 'easy',
    explanation: 'Hashing with algorithms like bcrypt using unique salts ensures passwords cannot be reverse-engineered even if database dumps are accessed.'
  },
  {
    questionText: 'What is a JSON Web Token (JWT) composed of?',
    options: [
      'Key and Value pairs separated by semicolons',
      'Three parts separated by dots: Header, Payload, and Signature',
      'An XML envelope and an encrypted SOAP body',
      'A cookie, a session ID, and an IP address'
    ],
    correctOptionIndex: 1,
    category: 'Security & Auth',
    difficulty: 'easy',
    explanation: 'A JWT consists of three parts concatenated by dots (.): Header (algorithm & token type), Payload (claims/data), and Signature.'
  },
  {
    questionText: 'What is the purpose of CORS (Cross-Origin Resource Sharing)?',
    options: [
      'To accelerate database indexing across multiple servers',
      'A browser security mechanism that restricts resources requested from another domain outside the given domain',
      'A CSS property for responsive typography across devices',
      'An Express template engine for server-side rendering'
    ],
    correctOptionIndex: 1,
    category: 'Web Development & APIs',
    difficulty: 'medium',
    explanation: 'CORS is a browser-implemented security mechanism that allows or restricts web applications running at one origin to access resources from a different origin.'
  },
  {
    questionText: 'Which React hook should be used to memoize expensive calculation results between re-renders?',
    options: [
      'useCallback',
      'useMemo',
      'useRef',
      'useReducer'
    ],
    correctOptionIndex: 1,
    category: 'React & Frontend',
    difficulty: 'medium',
    explanation: 'useMemo caches the result of a calculation between re-renders unless its dependencies change.'
  },
  {
    questionText: 'In Express, which built-in middleware is used to parse incoming JSON request payloads?',
    options: [
      'express.urlencoded()',
      'express.json()',
      'express.static()',
      'express.bodyParser()'
    ],
    correctOptionIndex: 1,
    category: 'Node.js & Express',
    difficulty: 'easy',
    explanation: 'express.json() is a built-in middleware function in Express that parses incoming requests with JSON payloads based on body-parser.'
  },
  {
    questionText: 'What does the MongoDB `_id` field default to if not specified upon document creation?',
    options: [
      'Auto-incrementing integer starting from 1',
      'An ObjectId consisting of a 12-byte BSON type',
      'A random UUID string',
      'Null'
    ],
    correctOptionIndex: 1,
    category: 'MongoDB & Databases',
    difficulty: 'medium',
    explanation: 'MongoDB automatically generates a 12-byte ObjectId composed of a timestamp, random values, and an incrementing counter for the _id field.'
  },
  {
    questionText: 'What is the advantage of using React keys when rendering lists of elements?',
    options: [
      'Keys automatically apply CSS styling',
      'Keys help React identify which items have changed, been added, or removed for efficient DOM reconciliation',
      'Keys encrypt the DOM node contents',
      'Keys make the list sortable automatically'
    ],
    correctOptionIndex: 1,
    category: 'React & Frontend',
    difficulty: 'medium',
    explanation: 'Keys give elements a stable identity, allowing React’s reconciliation algorithm to efficiently match existing virtual DOM trees with new ones.'
  },
  {
    questionText: 'What will `typeof NaN` return in JavaScript?',
    options: [
      '"undefined"',
      '"number"',
      '"nan"',
      '"object"'
    ],
    correctOptionIndex: 1,
    category: 'JavaScript Fundamentals',
    difficulty: 'easy',
    explanation: 'In JavaScript specification, NaN (Not a Number) is a numeric data type representing an unrepresentable value, so typeof NaN is "number".'
  }
];
