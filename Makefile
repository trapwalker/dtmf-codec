.PHONY: help install build clean dev demo test lint check-all

# Цвета для вывода
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Показать справку по доступным командам
	@echo "$(BLUE)Доступные команды:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Установить зависимости
	@echo "$(YELLOW)Установка зависимостей...$(NC)"
	@npm install

build: clean ## Собрать проект
	@echo "$(YELLOW)Сборка проекта...$(NC)"
	@npm run build
	@echo "$(GREEN)✓ Сборка завершена$(NC)"

clean: ## Очистить директорию dist
	@echo "$(YELLOW)Очистка dist...$(NC)"
	@npm run clean
	@echo "$(GREEN)✓ Очистка завершена$(NC)"

dev: ## Запустить watch режим для разработки
	@echo "$(YELLOW)Запуск режима разработки (watch)...$(NC)"
	@npm run dev

demo: build ## Запустить демо (требует предварительной сборки)
	@echo "$(YELLOW)Запуск демо-приложения...$(NC)"
	@echo "$(GREEN)Откройте браузер по адресу, который будет указан ниже$(NC)"
	@npm run demo

demo-fast: ## Запустить демо без сборки (использует исходники)
	@echo "$(YELLOW)Запуск демо-приложения (без сборки)...$(NC)"
	@echo "$(GREEN)Откройте браузер по адресу, который будет указан ниже$(NC)"
	@npm run demo

check-all: clean install build ## Полная проверка: очистка, установка и сборка
	@echo "$(GREEN)✓ Все проверки пройдены$(NC)"

full-test: build demo ## Полный тест: сборка и запуск демо (в фоне)
	@echo "$(GREEN)✓ Проект собран и готов к тестированию$(NC)"
	@echo "$(YELLOW)Запустите 'make demo-fast' в другом терминале для запуска демо$(NC)"

