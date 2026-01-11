#!/bin/bash

# Update all package.json files to use proper ESM exports

# Database package
cat > packages/database/package.json << 'EOF'
{
  "name": "@arc/database",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "migrate": "tsx src/migrations/run.ts",
    "seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.0",
    "@arc/shared": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
EOF

# LLM Client package
cat > packages/llm-client/package.json << 'EOF'
{
  "name": "@arc/llm-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "openai": "^4.28.0",
    "@anthropic-ai/sdk": "^0.17.0",
    "@arc/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
EOF

# Retriever package
cat > packages/retriever/package.json << 'EOF'
{
  "name": "@arc/retriever",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@arc/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
EOF

# Worker package
cat > packages/worker/package.json << 'EOF'
{
  "name": "@arc/worker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "discovery": "tsx src/cli.ts discovery",
    "lane-b": "tsx src/cli.ts lane-b",
    "ic-bundle": "tsx src/cli.ts ic-bundle"
  },
  "dependencies": {
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.0",
    "cron": "^3.1.0",
    "@arc/core": "workspace:*",
    "@arc/database": "workspace:*",
    "@arc/llm-client": "workspace:*",
    "@arc/retriever": "workspace:*",
    "@arc/shared": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
EOF

# API app
cat > apps/api/package.json << 'EOF'
{
  "name": "@arc/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "@arc/core": "workspace:*",
    "@arc/database": "workspace:*",
    "@arc/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
EOF

# Update all tsconfig.json files
for pkg in shared core database llm-client retriever worker; do
  cat > packages/$pkg/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF
done

# API tsconfig
cat > apps/api/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

echo "All package configurations updated!"
