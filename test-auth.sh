#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# API Base URL
BASE_URL="${API_URL:-http://localhost:4092}"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Global variables for tokens and IDs
ACCESS_TOKEN=""
REFRESH_TOKEN=""
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_USERNAME="user_$(date +%s)"
TEST_NAME="Auth Test User"

# Function to print colored status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $message"
        ((PASSED_TESTS++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗ FAIL${NC}: $message"
        ((FAILED_TESTS++))
    elif [ "$status" = "INFO" ]; then
        echo -e "${BLUE}ℹ INFO${NC}: $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠ WARN${NC}: $message"
    fi
    ((TOTAL_TESTS++))
}

# Function to perform a request and capture response
# Args: method, path, data (optional), auth_token (optional)
api_request() {
    local method=$1
    local path=$2
    local data=$3
    local auth_token=$4
    
    local curl_opts=("-s" "-X" "$method" "${BASE_URL}${path}")
    curl_opts+=("-H" "Content-Type: application/json")
    
    if [ -n "$auth_token" ]; then
        curl_opts+=("-H" "Authorization: Bearer $auth_token")
    fi
    
    if [ -n "$data" ]; then
        curl_opts+=("-d" "$data")
    fi
    
    curl "${curl_opts[@]}"
}

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  ElysiaJS Auth Testing Suite   ${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Base URL: $BASE_URL${NC}"
echo -e "${BLUE}Test User: $TEST_USERNAME ($TEST_EMAIL)${NC}"
echo ""

# 1. Health Check
echo -e "${YELLOW}=== 1. Health Check ===${NC}"
HEALTH_RESPONSE=$(api_request GET "/health")
if [ "$(echo "$HEALTH_RESPONSE" | jq -r '.status')" = "ok" ]; then
    print_status "PASS" "API is healthy"
else
    print_status "FAIL" "Health check failed: $HEALTH_RESPONSE"
fi

# 2. Registration
echo -e "\n${YELLOW}=== 2. User Registration ===${NC}"
REG_DATA=$(printf '{"email":"%s","password":"%s","name":"%s","username":"%s"}' "$TEST_EMAIL" "$TEST_PASSWORD" "$TEST_NAME" "$TEST_USERNAME")
REG_RESPONSE=$(api_request POST "/api/auth/register" "$REG_DATA")

if [ "$(echo "$REG_RESPONSE" | jq -r '.success')" = "true" ]; then
    print_status "PASS" "Successful registration"
else
    print_status "FAIL" "Registration failed: $REG_RESPONSE"
fi

# 3. Duplicate Registration (Negative)
echo -e "\n${YELLOW}=== 3. Duplicate Registration (Negative) ===${NC}"
DUP_RESPONSE=$(api_request POST "/api/auth/register" "$REG_DATA")
if [ "$(echo "$DUP_RESPONSE" | jq -r '.success')" != "true" ]; then
    print_status "PASS" "Prevented duplicate registration"
else
    print_status "FAIL" "Duplicate registration allowed!"
fi

# 4. Login (Wrong Password) (Negative)
echo -e "\n${YELLOW}=== 4. Login with Wrong Password (Negative) ===${NC}"
WRONG_PASS_DATA=$(printf '{"email":"%s","password":"WrongPassword123"}' "$TEST_EMAIL")
WRONG_LOGIN_RESPONSE=$(api_request POST "/api/auth/login" "$WRONG_PASS_DATA")
if [ "$(echo "$WRONG_LOGIN_RESPONSE" | jq -r '.success')" != "true" ]; then
    print_status "PASS" "Prevented login with wrong password"
else
    print_status "FAIL" "Login with wrong password allowed!"
fi

# 5. Successful Login
echo -e "\n${YELLOW}=== 5. Successful Login ===${NC}"
LOGIN_DATA=$(printf '{"email":"%s","password":"%s"}' "$TEST_EMAIL" "$TEST_PASSWORD")
LOGIN_RESPONSE=$(api_request POST "/api/auth/login" "$LOGIN_DATA")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // empty')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken // empty')

if [ -n "$ACCESS_TOKEN" ] && [ -n "$REFRESH_TOKEN" ]; then
    print_status "PASS" "Login successful"
else
    print_status "FAIL" "Login failed to return tokens: $LOGIN_RESPONSE"
    exit 1
fi

# 6. Get Current User Info
echo -e "\n${YELLOW}=== 6. Get Current User Info ===${NC}"
ME_RESPONSE=$(api_request GET "/api/auth/me" "" "$ACCESS_TOKEN")
if [ "$(echo "$ME_RESPONSE" | jq -r '.user.email')" = "$TEST_EMAIL" ]; then
    print_status "PASS" "Profile data matches"
else
    print_status "FAIL" "Profile data mismatch: $ME_RESPONSE"
fi

# 7. Token Refresh
echo -e "\n${YELLOW}=== 7. Token Refresh ===${NC}"
REFRESH_DATA=$(printf '{"refresh_token":"%s"}' "$REFRESH_TOKEN")
REFRESH_RESPONSE=$(api_request POST "/api/auth/refresh-token" "$REFRESH_DATA")

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.accessToken // empty')
NEW_REFRESH_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.refreshToken // empty')

if [ -n "$NEW_ACCESS_TOKEN" ] && [ -n "$NEW_REFRESH_TOKEN" ] && [ "$NEW_REFRESH_TOKEN" != "$REFRESH_TOKEN" ]; then
    print_status "PASS" "Token refreshed and rotated"
    ACCESS_TOKEN=$NEW_ACCESS_TOKEN
    REFRESH_TOKEN=$NEW_REFRESH_TOKEN
else
    print_status "FAIL" "Token refresh failed: $REFRESH_RESPONSE"
fi

# 8. Use New Access Token
echo -e "\n${YELLOW}=== 8. Use New Access Token ===${NC}"
NEW_ME_RESPONSE=$(api_request GET "/api/auth/me" "" "$ACCESS_TOKEN")
if [ "$(echo "$NEW_ME_RESPONSE" | jq -r '.user.email')" = "$TEST_EMAIL" ]; then
    print_status "PASS" "New access token is valid"
else
    print_status "FAIL" "New access token rejected: $NEW_ME_RESPONSE"
fi

# 9. Logout
echo -e "\n${YELLOW}=== 9. Logout ===${NC}"
LOGOUT_RESPONSE=$(api_request POST "/api/auth/logout" "" "$ACCESS_TOKEN")
# Note: Logout might not return JSON, check http status or success field if exists
if [ "$(echo "$LOGOUT_RESPONSE" | jq -r '.success // true')" = "true" ]; then
    print_status "PASS" "User logout successful"
else
    print_status "FAIL" "Logout failed: $LOGOUT_RESPONSE"
fi

# 10. Access Protected Route after Logout (Negative)
echo -e "\n${YELLOW}=== 10. Access After Logout (Negative) ===${NC}"
POST_LOGOUT_RESPONSE=$(api_request GET "/api/auth/me" "" "$ACCESS_TOKEN")
if [ "$(echo "$POST_LOGOUT_RESPONSE" | jq -r '.success')" != "true" ]; then
    print_status "PASS" "Protected route rejected after logout"
else
    print_status "FAIL" "Protected route still accessible after logout!"
fi

# Summary
echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}      Test Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✓ All auth tests completed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed!${NC}"
    exit 1
fi
