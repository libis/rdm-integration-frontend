# Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License
.SILENT:
SHELL = /bin/bash

eslint: ## eslint the go code
	npx eslint src/app/** --fix

upgrade_dependencies: ## upgrade all go dependencies
	npx npm-check-updates -u && npm install