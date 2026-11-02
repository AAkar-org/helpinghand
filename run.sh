#!/usr/bin/env bash

# ==============================================================================
# Helping Hand - Continuous App Runner & Auto-Restart Script
# ==============================================================================
# Continuously runs the selected Helping Hand app in an auto-restart loop.
# If the app crashes, disconnects, or terminates, it automatically relaunches
# after a brief countdown.
#
# Usage:
#   ./run.sh                     # Interactive selection (defaults to Worker App)
#   ./run.sh worker              # Continuously run the Worker App
#   ./run.sh employer            # Continuously run the Employer App
#   ./run.sh backend             # Continuously run the Backend Server
#   ./run.sh worker -d linux     # Run on Linux desktop
#   ./run.sh worker --emulator   # Auto-launch Android emulator before running
#   ./run.sh --help              # Display usage instructions
# ==============================================================================

set -o pipefail

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Determine project root directory
INVOCATION_DIR="$PWD"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

# Performance / Graphics optimization for Android Emulator on Linux (from flake.nix)
export ANDROID_EMULATOR_USE_SYSTEM_LIBS="1"

# Ensure Flutter is in PATH
find_flutter() {
    if command -v flutter >/dev/null 2>&1; then
        return 0
    fi

    # Check known FVM, local Nix, or custom SDK paths
    local candidate_paths=(
        "$HOME/fvm/versions/stable/bin"
        "/home/aman/fvm/versions/stable/bin"
        "$HOME/fvm/default/bin"
        "$HOME/.local/bin"
        "$HOME/development/flutter/bin"
        "$HOME/flutter/bin"
        "/opt/flutter/bin"
    )

    for p in "${candidate_paths[@]}"; do
        if [ -x "$p/flutter" ]; then
            export PATH="$p:$PATH"
            return 0
        fi
    done

    return 1
}

find_flutter
FLUTTER_AVAILABLE=$?

# Print stylish banner
echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          🤝 Helping Hand - Continuous App Runner               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

TARGET=""
LAUNCH_EMULATOR=false
FORCE_CLEAN=false
EXTRA_ARGS=()

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        worker|w|--worker)
            TARGET="worker"
            shift
            ;;
        employer|e|--employer)
            TARGET="employer"
            shift
            ;;
        backend|b|--backend)
            TARGET="backend"
            shift
            ;;
        -e|--emulator)
            LAUNCH_EMULATOR=true
            shift
            ;;
        -c|--clean)
            FORCE_CLEAN=true
            shift
            ;;
        help|-h|--help)
            echo -e "${BOLD}Usage:${NC}"
            echo "  ./run.sh [target] [options...]"
            echo ""
            echo -e "${BOLD}Targets:${NC}"
            echo "  worker, w       Run Worker App (Flutter)"
            echo "  employer, e     Run Employer App (Flutter)"
            echo "  backend, b      Run Backend API (Node.js/Express)"
            echo ""
            echo -e "${BOLD}Options:${NC}"
            echo "  -c, --clean     Run flutter clean & pub get before launching"
            echo "  -e, --emulator  Launch the Android emulator (Medium_Phone) if not active"
            echo "  -d <device-id>  Target a specific device (e.g. linux, Medium_Phone)"
            echo "  -h, --help      Show this help dialog"
            echo ""
            echo -e "${BOLD}Examples:${NC}"
            echo "  ./run.sh worker"
            echo "  ./run.sh worker --clean"
            echo "  ./run.sh worker --emulator"
            echo "  ./run.sh employer -d linux"
            echo "  ./run.sh backend"
            exit 0
            ;;
        *)
            EXTRA_ARGS+=("$1")
            shift
            ;;
    esac
done

# If target is not specified, infer from current invocation directory
if [ -z "$TARGET" ]; then
    CURRENT_FOLDER="$(basename "$INVOCATION_DIR")"
    if [ "$CURRENT_FOLDER" = "helping-hand-worker-app" ]; then
        TARGET="worker"
    elif [ "$CURRENT_FOLDER" = "helping-hand-employer" ]; then
        TARGET="employer"
    elif [ "$CURRENT_FOLDER" = "helping-hand-backend" ]; then
        TARGET="backend"
    fi
fi

# If target is still undetermined, prompt interactively
if [ -z "$TARGET" ]; then
    echo -e "${BOLD}Select the application to run continuously:${NC}"
    echo -e "  ${GREEN}1)${NC} Worker App    ${BLUE}(helping-hand-worker-app)${NC} [Default]"
    echo -e "  ${GREEN}2)${NC} Employer App  ${BLUE}(helping-hand-employer)${NC}"
    echo -e "  ${GREEN}3)${NC} Backend API   ${BLUE}(helping-hand-backend)${NC}"
    echo ""
    read -r -t 10 -p "Enter choice [1-3, default: 1]: " USER_CHOICE || USER_CHOICE="1"
    echo ""

    case "$USER_CHOICE" in
        2|employer|e)
            TARGET="employer"
            ;;
        3|backend|b)
            TARGET="backend"
            ;;
        *)
            TARGET="worker"
            ;;
    esac
fi

# Configure directories and environment based on target
case "$TARGET" in
    worker)
        APP_NAME="Worker App"
        APP_DIR="$ROOT_DIR/helping-hand-worker-app"
        IS_FLUTTER=true
        ;;
    employer)
        APP_NAME="Employer App"
        APP_DIR="$ROOT_DIR/helping-hand-employer"
        IS_FLUTTER=true
        ;;
    backend)
        APP_NAME="Backend API"
        APP_DIR="$ROOT_DIR/helping-hand-backend"
        IS_FLUTTER=false
        ;;
    *)
        echo -e "${RED}Error: Unknown target '$TARGET'${NC}"
        exit 1
        ;;
esac

echo -e "Selected target: ${GREEN}${BOLD}$APP_NAME${NC}"
echo -e "Working directory: ${BLUE}$APP_DIR${NC}"

# Check prerequisites
if [ "$IS_FLUTTER" = true ]; then
    if [ $FLUTTER_AVAILABLE -ne 0 ]; then
        echo -e "${RED}Error: Flutter SDK not found in PATH or standard FVM directories.${NC}"
        echo "Please ensure Flutter or FVM is installed."
        exit 1
    fi
    echo -e "Flutter binary:  ${CYAN}$(command -v flutter)${NC}"

    # Auto-detect stale CMakeCache from moved project directory
    CMAKE_CACHE="$APP_DIR/build/linux/x64/debug/CMakeCache.txt"
    if [ -f "$CMAKE_CACHE" ]; then
        CACHED_DIR="$(grep -m 1 "^CMAKE_CACHEFILE_DIR:INTERNAL=" "$CMAKE_CACHE" 2>/dev/null | cut -d'=' -f2)"
        EXPECTED_DIR="$APP_DIR/build/linux/x64/debug"
        if [ -n "$CACHED_DIR" ] && [ "$CACHED_DIR" != "$EXPECTED_DIR" ]; then
            echo -e "${YELLOW}Notice: Detected stale CMake cache from previous directory:${NC}"
            echo -e "  Old: ${RED}$CACHED_DIR${NC}"
            echo -e "  New: ${GREEN}$EXPECTED_DIR${NC}"
            echo -e "${CYAN}Triggering automatic clean to prevent CMake error...${NC}"
            FORCE_CLEAN=true
        fi
    fi

    if [ "$FORCE_CLEAN" = true ]; then
        echo -e "${CYAN}Running flutter clean and flutter pub get...${NC}"
        (cd "$APP_DIR" && flutter clean && flutter pub get)
        echo -e "${GREEN}Clean completed successfully.${NC}"
    fi

    # Handle Android emulator launch if requested or if no devices are running
    if [ "$LAUNCH_EMULATOR" = true ]; then
        echo -e "${CYAN}Launching Android emulator...${NC}"
        flutter emulators --launch Medium_Phone 2>/dev/null || flutter emulators --launch "$(flutter emulators 2>/dev/null | awk 'NR==4 {print $1}')" || true
        echo -e "${GREEN}Emulator launch triggered. Waiting 5s for initialization...${NC}"
        sleep 5
    fi
else
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${RED}Error: npm / node not found in PATH.${NC}"
        exit 1
    fi
    echo -e "Node binary:     ${CYAN}$(command -v node)${NC}"
fi

# Track state for graceful shutdown
IN_COUNTDOWN=0
LAST_SIGINT_TIME=0

handle_sigint() {
    local now
    now=$(date +%s)

    # Double Ctrl+C within 2 seconds immediately exits
    if (( now - LAST_SIGINT_TIME <= 2 )); then
        echo ""
        echo -e "${YELLOW}Quitting immediately.${NC}"
        exit 0
    fi
    LAST_SIGINT_TIME=$now

    # If Ctrl+C occurs during restart countdown, quit loop cleanly
    if [ "$IN_COUNTDOWN" -eq 1 ]; then
        echo ""
        echo -e "${YELLOW}Continuous runner stopped.${NC}"
        exit 0
    fi
}

trap handle_sigint SIGINT SIGTERM

RUN_COUNT=0
RESTART_DELAY=3

echo ""
echo -e "${BOLD}${BLUE}Starting continuous execution loop...${NC}"
echo -e "App will automatically relaunch whenever it exits or crashes."
echo -e "During countdown, press ${GREEN}[r]${NC} to restart immediately or ${RED}[q]${NC} to quit."
echo "════════════════════════════════════════════════════════════════"

while true; do
    RUN_COUNT=$((RUN_COUNT + 1))
    START_TIME=$(date +%s)
    IN_COUNTDOWN=0

    echo ""
    echo -e "${CYAN}${BOLD}[Iteration #$RUN_COUNT] Launching $APP_NAME at $(date '+%Y-%m-%d %H:%M:%S')...${NC}"
    echo "────────────────────────────────────────────────────────────────"

    cd "$APP_DIR" || exit 1

    if [ "$IS_FLUTTER" = true ]; then
        if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
            flutter run "${EXTRA_ARGS[@]}"
        else
            flutter run
        fi
        EXIT_CODE=$?
    else
        if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
            npm run dev -- "${EXTRA_ARGS[@]}"
        else
            npm run dev
        fi
        EXIT_CODE=$?
    fi

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    echo "────────────────────────────────────────────────────────────────"
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ $APP_NAME exited cleanly (status 0, ran for ${DURATION}s).${NC}"
    else
        echo -e "${YELLOW}! $APP_NAME terminated with status $EXIT_CODE (ran for ${DURATION}s).${NC}"
    fi

    # Countdown with interactive prompt
    IN_COUNTDOWN=1
    echo ""
    echo -e "${BOLD}Auto-restarting in $RESTART_DELAY seconds...${NC}"
    echo -e "Press ${GREEN}[r]${NC} / ${GREEN}[Enter]${NC} to restart now, or ${RED}[q]${NC} to quit."

    USER_INPUT=""
    read -r -t "$RESTART_DELAY" -n 1 USER_INPUT 2>/dev/null || true
    echo ""

    if [[ "$USER_INPUT" == "q" || "$USER_INPUT" == "Q" ]]; then
        echo -e "${GREEN}Quit requested. Exiting continuous run loop.${NC}"
        break
    fi
done
