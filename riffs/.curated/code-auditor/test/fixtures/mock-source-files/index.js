#!/usr/bin/env node

/**
 * Mock index file that imports some dependencies
 * This file is used to test the dependency-audit riff
 */

import chalk from 'chalk';
import { someFunction } from 'used-dependency';

/**
 * Main function that uses the imported dependencies
 */
function main() {
    console.log(chalk.green('[PASS] This is a test message'));

    // Use the imported function from used-dependency
    const result = someFunction();
    console.log(`Result: ${result}`);
}

// Run the main function
main();
