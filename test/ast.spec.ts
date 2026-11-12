import { parseSync } from 'sh-syntax/sync'

const script = `#!/usr/bin/env bash
# top-level comment
foo=bar
export BAZ="qux"
echo "hi $foo" >out 2>&1

if [[ -n $foo ]]; then
  echo yes
elif false; then
  echo no
else
  echo maybe
fi

for x in a b; do
  echo "$x"
done

while read -r line; do
  echo "$line"
done < input

case $foo in
  a) echo a ;;
  *) echo other ;;
esac

f() {
  local x=1
  echo "$x"
}

(echo sub)
{ echo block; }
echo $((1 + 2)) \${foo:-default}
cat <<EOF
hello $foo
EOF
`

test('full AST snapshot', () => {
  expect(parseSync(script, { keepComments: true })).toMatchSnapshot()
})
