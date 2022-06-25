import { runAsWorker } from 'synckit'

import { print } from '../lib/index.js'

runAsWorker(print)
