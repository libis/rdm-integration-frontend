# Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License
.SILENT:
SHELL = /bin/bash

# Minimum coverage threshold (can be overridden: `make coverage-check MIN_COVERAGE=75` or env MIN_COVERAGE=75)
MIN_COVERAGE ?= 70

lint: ## lint
	npm run lint

upgrade_dependencies: ## upgrade all go dependencies
	npx npm-check-updates -u && npm install

fmt: ## format code (ts, html, css, scss, json)
	npm run pretty

test: ## run all unit/integration tests headless (single run)
	npm run test:ci

test-watch: ## developer watch mode tests (interactive Chrome)
	npm test

coverage: ## run tests and generate coverage report (HTML in coverage/datasync)
	npm run test:ci
	@echo "Coverage HTML: coverage/datasync/index.html"
	@node -e 'const fs=require("fs");const p="coverage/datasync/coverage-summary.json";if(!fs.existsSync(p)){console.warn("coverage-summary.json not found; ensure karma-coverage ran.");process.exit(0);}let raw=fs.readFileSync(p,"utf8");try{const json=JSON.parse(raw);const t=json.total||{};function fmt(v){return (typeof v==="number"?v.toFixed(2):"n/a");}const line="Coverage Summary -> Statements: "+fmt(t.statements&&t.statements.pct)+"% | Branches: "+fmt(t.branches&&t.branches.pct)+"% | Functions: "+fmt(t.functions&&t.functions.pct)+"% | Lines: "+fmt(t.lines&&t.lines.pct)+"%";console.log(line);}catch(e){console.error("Failed to parse coverage-summary.json:",e.message);process.exit(1);}'

coverage-check: ## run coverage and fail if below MIN_COVERAGE (default $(MIN_COVERAGE)%)
	$(MAKE) coverage
	@node -e 'const fs=require("fs");const min=Number(process.env.MIN_COVERAGE||"$(MIN_COVERAGE)");const p="coverage/datasync/coverage-summary.json";if(!fs.existsSync(p)){console.error("No coverage summary found ("+p+")");process.exit(2);}let raw=fs.readFileSync(p,"utf8");let json;try{json=JSON.parse(raw);}catch(e){console.error("Parse error:",e.message);process.exit(2);}const pct=(json.total&&json.total.statements&&json.total.statements.pct)||0;console.log("Enforce: statements "+pct+"% (min "+min+"%)"); if(pct < min){console.error("Coverage threshold not met"); process.exit(1);}'

ci: ## run lint, format (write), and tests (headless)
	$(MAKE) eslint
	$(MAKE) fmt
	$(MAKE) test
