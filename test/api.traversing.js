var expect = require('expect.js'),
    $ = require('../'),
    food = require('./fixtures').food,
    fruits = require('./fixtures').fruits,
		form = require('./fixtures').form;

describe('$(...)', function() {

  describe('.find', function() {

    it('() : should return this', function() {
      expect($('ul', fruits).find()[0].name).to.equal('ul');
    });

    it('(single) : should find one descendant', function() {
      expect($('#fruits', fruits).find('.apple')[0].attribs['class']).to.equal('apple');
    });

    it('(many) : should find all matching descendant', function() {
      expect($('#fruits', fruits).find('li')).to.have.length(3);
    });

    it('(many) : should merge all selected elems with matching descendants');

    it('(invalid single) : should return empty if cant find', function() {
      expect($('ul', fruits).find('blah')).to.have.length(0);
    });

    it('(invalid single) : should query descendants only', function() {
      expect($('#fruits', fruits).find('ul')).to.have.length(0);
    });

    it('should return empty if search already empty result', function() {
      expect($('#fruits').find('li')).to.have.length(0);
    });

  });

  describe('.children', function() {

    it('() : should get all children', function() {
      expect($('ul', fruits).children()).to.have.length(3);
    });

    it('() : should return children of all matched elements', function() {
      expect($('ul ul', food).children()).to.have.length(5);
    });

    it('(selector) : should return children matching selector', function() {
      var cls = $('ul', fruits).children('.orange')[0].attribs['class'];
      expect(cls).to.equal('orange');
    });

    it('(invalid selector) : should return empty', function() {
      expect($('ul', fruits).children('.lulz')).to.have.length(0);
    });

    it('should only match immediate children, not ancestors');

  });

  describe('.next', function() {

    it('() : should return next element', function() {
      var cls = $('.orange', fruits).next()[0].attribs['class'];
      expect(cls).to.equal('pear');
    });

    it('(no next) : should return null (?)');

  });

  describe('.prev', function() {

    it('() : should return previous element', function() {
      var cls = $('.orange', fruits).prev()[0].attribs['class'];
      expect(cls).to.equal('apple');
    });

    it('(no prev) : should return null (?)');

  });

  describe('.siblings', function() {

    it('() : should get all the siblings', function() {
      expect($('.orange', fruits).siblings()).to.have.length(2);
    });

    it('(selector) : should get all siblings that match the selector', function() {
      expect($('.orange', fruits).siblings('li')).to.have.length(2);
    });

  });

  describe('.each', function() {

    it('( (i, elem) -> ) : should loop selected returning fn with (i, elem)', function() {
      var items = [],
          classes = ['apple', 'orange', 'pear'];
      $('li', fruits).each(function(idx, elem) {
        items[idx] = elem;
        expect(this[0].attribs['class']).to.equal(classes[idx]);
      });
      expect(items[0].attribs['class']).to.equal('apple');
      expect(items[1].attribs['class']).to.equal('orange');
      expect(items[2].attribs['class']).to.equal('pear');
    });

    it('( (i, elem) -> ) : should break iteration when the iterator function returns false', function() {

        var iterationCount = 0;
        $('li', fruits).each(function(idx, elem) {
          iterationCount++;
          return idx < 1;
        });

        expect(iterationCount).to.equal(2);
    });

  });

  describe('.map', function() {
    it('(fn) : should return an array of mapped items', function() {
      var classes = $('li', fruits).map(function(i, el) {
        expect(this[0]).to.be(el);
        expect(el.name).to.be('li');
        expect(i).to.be.a('number');
        return el.attribs['class'];
      }).join(', ');

      expect(classes).to.be('apple, orange, pear');
    });
  });
  
  describe('.filter', function() {
    it('(selector) : should reduce the set of matched elements to those that match the selector', function() {
      var pear = $('li', fruits).filter('.pear').text();
      expect(pear).to.be('Pear');
    });

    it('(selector) : should not consider nested elements', function() {
      var lis = $(fruits).filter('li');
      expect(lis).to.have.length(0);
    });
    
    it('(fn) : should reduce the set of matched elements to those that pass the function\'s test', function() {
      var orange = $('li', fruits).filter(function(i, el) {
        expect(this[0]).to.be(el);
        expect(el.name).to.be('li');
        expect(i).to.be.a('number');
        return this.attr('class') === 'orange';
      }).text();

      expect(orange).to.be('Orange');
    });
  });

  describe('.first', function() {

    it('() : should return the first item', function() {
      var $src = $('<span>foo</span><span>bar</span><span>baz</span>');
      var $elem = $src.first();
      expect($elem.length).to.equal(1);
      expect($elem[0].children[0].data).to.equal('foo');
    });

    it('() : should return an empty object for an empty object', function() {
      var $src = $();
      var $first = $src.first();
      expect($first.length).to.equal(0);
      expect($first[0]).to.be(undefined);
    });

  });

  describe('.last', function() {

    it('() : should return the last element', function() {
      var $src = $('<span>foo</span><span>bar</span><span>baz</span>');
      var $elem = $src.last();
      expect($elem.length).to.equal(1);
      expect($elem[0].children[0].data).to.equal('baz');
    });

    it('() : should return an empty object for an empty object', function() {
      var $src = $();
      var $last = $src.last();
      expect($last.length).to.equal(0);
      expect($last[0]).to.be(undefined);
    });

  });

  describe('.first & .last', function() {

    it('() : should return equivalent collections if only one element', function() {
      var $src = $('<span>bar</span>');
      var $first = $src.first();
      var $last = $src.last();
      expect($first.length).to.equal(1);
      expect($first[0].children[0].data).to.equal('bar');
      expect($last.length).to.equal(1);
      expect($last[0].children[0].data).to.equal('bar');
      expect($first[0]).to.equal($last[0]);
    });

  });

  describe('.eq', function() {

    function getText(el) {
      if(!el.length) return '';
      return el[0].children[0].data;
    }

    it('(i) : should return the element at the specified index', function() {
      expect(getText($('li', fruits).eq(0))).to.equal('Apple');
      expect(getText($('li', fruits).eq(1))).to.equal('Orange');
      expect(getText($('li', fruits).eq(2))).to.equal('Pear');
      expect(getText($('li', fruits).eq(3))).to.equal('');
      expect(getText($('li', fruits).eq(-1))).to.equal('Pear');
    });

  });

	describe('.index', function(){
		var obj = $('li:nth-child(2)', fruits);
		expect(obj.index()).to.equal(1);


		//$(require('./fixtures').form).serializeArray();
	});

	describe('.has', function(){
		it('', function(){
			var html = '<div><p>first</p></div><div><p class="red">second</p></div><div><p>third</p></div>';
			var list = $(html).has(".red");
			var review = '<div><p class="red">second</p></div>';
			expect(list.toString()).to.be.equal(review);
			//console.log(list);
		});
	});

	describe('.not', function(){
		it('.not(): Filter the current collection to get a new collection of elements that don’t match the CSS selector. ', function(){
			var html = '<p>first</p><p class="red">second</p><p>third</p>';
			var list = $("p", html).not(".red");
			expect(list.toString()).to.be.equal('<p>first</p><p>third</p>');
		});
	});
});
