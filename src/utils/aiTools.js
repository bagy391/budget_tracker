/**
 * Gemini Tool / Function Declarations for Dynamic Financial Data Retrieval.
 * Allows the AI to query historical transactions, date ranges, and categories on demand.
 */
export const FINANCIAL_TOOLS = [
    {
        function_declarations: [
            {
                name: 'getWealthPortfolio',
                description: 'Retrieve and analyze wealth portfolio, asset allocation, net worth, total invested, current valuation, unrealized gains/losses, and ROI for either the user\'s personal portfolio (own assets) or the joint family portfolio (all household assets).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        scope: {
                            type: 'STRING',
                            enum: ['personal', 'family'],
                            description: '"personal" for only the user\'s own assets, "family" for the entire joint family portfolio'
                        },
                        assetType: {
                            type: 'STRING',
                            description: 'Optional filter by asset type: "mutual_fund", "stock", "epf", "nps", "bank", "fd", or "all"'
                        }
                    }
                }
            },
            {
                name: 'getIncomeBreakdown',
                description: 'Retrieve real household income data from the database: monthly income breakdown, total income, average monthly income, income sources (Salary, Freelance, etc.), and individual income entries for ANY date range or past year.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        startDate: {
                            type: 'STRING',
                            description: 'Start date in YYYY-MM-DD format (e.g. "2026-01-01"). Optional, defaults to start of current year or earliest recorded income.'
                        },
                        endDate: {
                            type: 'STRING',
                            description: 'End date in YYYY-MM-DD format (e.g. "2026-10-31"). Optional, defaults to today.'
                        },
                        source: {
                            type: 'STRING',
                            description: 'Optional filter by specific source name (e.g. "Bonus"). Leave this blank/omitted when asking for general income, salary, or monthly breakdown so all income records are included.'
                        }
                    }
                }
            },
            {
                name: 'searchTransactions',
                description: 'Search individual transactions (expenses and incomes) across any historical date range by merchant/source keyword, category, date, or amount.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: {
                            type: 'STRING',
                            description: 'Keyword to search in description, source, or notes (e.g. "Swiggy", "Salary", "Amazon", "Freelance")'
                        },
                        startDate: {
                            type: 'STRING',
                            description: 'Start date in YYYY-MM-DD format (e.g. "2026-01-01")'
                        },
                        endDate: {
                            type: 'STRING',
                            description: 'End date in YYYY-MM-DD format (e.g. "2026-12-31")'
                        },
                        type: {
                            type: 'STRING',
                            enum: ['all', 'expense', 'income'],
                            description: 'Transaction type: "all", "expense", or "income"'
                        },
                        category: {
                            type: 'STRING',
                            description: 'Filter by category name (e.g. "Food", "Entertainment", "Groceries", "Income")'
                        },
                        minAmount: {
                            type: 'NUMBER',
                            description: 'Minimum amount filter in INR'
                        },
                        maxAmount: {
                            type: 'NUMBER',
                            description: 'Maximum amount filter in INR'
                        },
                        scope: {
                            type: 'STRING',
                            enum: ['personal', 'family'],
                            description: '"personal" for only the user, "family" for the whole household'
                        },
                        limit: {
                            type: 'NUMBER',
                            description: 'Max number of transactions to return (default 50, max 200)'
                        }
                    }
                }
            },
            {
                name: 'getSpendingSummary',
                description: 'Calculate total spending, income, savings, category breakdown, AND monthly breakdown for ANY specific date range (past months, specific quarters, or past years).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        startDate: {
                            type: 'STRING',
                            description: 'Start date in YYYY-MM-DD format'
                        },
                        endDate: {
                            type: 'STRING',
                            description: 'End date in YYYY-MM-DD format'
                        },
                        category: {
                            type: 'STRING',
                            description: 'Optional category name to get total for only that category'
                        },
                        scope: {
                            type: 'STRING',
                            enum: ['personal', 'family'],
                            description: '"personal" for current user, "family" for household'
                        }
                    },
                    required: ['startDate', 'endDate']
                }
            },
            {
                name: 'compareSpendingPeriods',
                description: 'Directly compare spending and income between two distinct time periods (e.g. Last Month vs Previous Month, or July 2024 vs July 2025).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        period1Start: {
                            type: 'STRING',
                            description: 'First period start date YYYY-MM-DD'
                        },
                        period1End: {
                            type: 'STRING',
                            description: 'First period end date YYYY-MM-DD'
                        },
                        period2Start: {
                            type: 'STRING',
                            description: 'Second period start date YYYY-MM-DD'
                        },
                        period2End: {
                            type: 'STRING',
                            description: 'Second period end date YYYY-MM-DD'
                        },
                        category: {
                            type: 'STRING',
                            description: 'Optional category to compare'
                        },
                        scope: {
                            type: 'STRING',
                            enum: ['personal', 'family']
                        }
                    },
                    required: ['period1Start', 'period1End', 'period2Start', 'period2End']
                }
            },
            {
                name: 'getBudgetStatus',
                description: 'Check active budget limits, amounts spent, and whether categories are over budget for a specific period.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        startDate: {
                            type: 'STRING',
                            description: 'Date in YYYY-MM-DD or start of period'
                        },
                        endDate: {
                            type: 'STRING',
                            description: 'Date in YYYY-MM-DD or end of period'
                        }
                    }
                }
            },
            {
                name: 'getRecurringSubscriptions',
                description: 'List all recurring subscriptions, regular bills, and ongoing payments.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        scope: {
                            type: 'STRING',
                            enum: ['personal', 'family']
                        }
                    }
                }
            }
        ]
    }
];
