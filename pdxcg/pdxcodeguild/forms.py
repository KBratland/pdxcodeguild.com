from django import forms
from crispy_forms.helper import FormHelper, Layout
from crispy_forms.layout import Submit
from crispy_forms.bootstrap import InlineRadios
from django.core.validators import RegexValidator
from django.forms.extras.widgets import SelectDateWidget
from captcha.fields import ReCaptchaField
from .models import NewStudentApplication, StudentIntake


class NewStudentApp(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super(NewStudentApp, self).__init__(*args, **kwargs)
        self.helper = FormHelper(self)
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Submit'))

    QUESTION_CHOICES = (
        ('Yes', 'Yes'),
        ('No', 'No'),
    )
    BIRTH_YEARS = (
        2014,
        2013,
        2012,
        2011,
        2010,
        2009,
        2008,
        2007,
        2006,
        2005,
        2004,
        2003,
        2002,
        2001,
        2000,
        1999,
        1998,
        1997,
        1996,
        1995,
        1994,
        1993,
        1992,
        1991,
        1990,
        1989,
        1988,
        1987,
        1986,
        1985,
        1984,
        1983,
        1982,
        1981,
        1980,
        1979,
        1978,
        1977,
        1976,
        1975,
        1974,
        1973,
        1972,
        1971,
        1970,
        1969,
        1968,
        1967,
        1966,
        1965,
        1964,
        1963,
        1962,
        1961,
        1960,
        1959,
        1958,
        1957,
        1956,
        1955,
        1954,
        1953,
        1952,
        1951,
        1950,
        1949,
        1948,
        1947,
        1946,
        1945,
        1944,
        1943,
        1942,
        1941,
        1940,
        1939,
        1938,
        1937,
        1936,
        1935,
        1934,
        1933,
        1932,
        1931,
        1930,
        1929,
        1928,
        1927,
        1926,
        1925,
        1924,
        1923,
        1922,
        1921,
        1920,
        1919,
        1918,
        1917,
        1916,
        1915,
        1914,
        1913,
        1912,
        1911,
        1910,
        1909,
        1908,
        1907,
        1906,
        1905,
        1904,
        1903,
        1902,
        1901,
        1900,
    )



    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )

    first_name = forms.CharField(
        max_length=255,
        label="Name:",
        required=True,
    )

    middle_initial = forms.CharField(
        max_length=1,
        required=False,
    )
    last_name = forms.CharField(
        max_length=255,
        required=True,
    )
    date_of_birth = forms.DateField(
        widget=SelectDateWidget(years=BIRTH_YEARS),
        required=True,
    )
    street_address = forms.CharField(
        max_length=255,
        required=True,
    )
    city = forms.CharField(
        max_length=255,
        required=True,
    )
    state = forms.CharField(
        max_length=255,
        required=True,
    )

    zip = forms.IntegerField(
        required=True,
    )

    applied_before = forms.ChoiceField(
        choices=QUESTION_CHOICES,
        required=True,
    )

    if_yes_app = forms.DateField(
        widget=SelectDateWidget(years=BIRTH_YEARS),
        required=False,
    )

    attended_before = forms.ChoiceField(
        choices=QUESTION_CHOICES,
        required=True,
    )

    if_yes_grad = forms.CharField(
        max_length=255,
        required=False,
    )

    if_no_grad = forms.Textarea(
    )

    phone_number = forms.CharField(
        validators=[phone_regex],
    )

    message_number = forms.CharField(
        validators=[phone_regex],
        required=False,
    )

    cell_number = forms.CharField(
        validators=[phone_regex],
        required=False,
    )

    email = forms.EmailField(
        required=True,
    )
    us_citizen = forms.ChoiceField(
        choices=QUESTION_CHOICES,
        required=True,
    )

    # Emergency Contact Information

    contact_name = forms.CharField(
        max_length=255,
        required=True,
    )

    contact_address = forms.CharField(
        max_length=255,
        required=True,
    )

    contact_city = forms.CharField(
        max_length=255,
        required=True,
    )

    contact_state = forms.CharField(
        max_length=255,
        required=True,
    )

    contact_zip = forms.CharField(
        max_length=255,
        required=True,
    )

    contact_number = forms.CharField(
        validators=[phone_regex],
        required=True,
    )

    class Meta:
        model = NewStudentApplication


class PostForm(forms.Form):
    full_name = forms.CharField(max_length=256)
    phone_number = forms.CharField(max_length=15, required=False)
    email_address = forms.EmailField()
    what_can_we_help_you_acheieve = forms.CharField(widget=forms.Textarea)


class Contact(forms.Form):
    def __init__(self, *args, **kwargs):
        super(Contact, self).__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_class = 'form-horizontal'
        self.helper.label_class = 'col-lg-3'
        self.helper.field_class = 'col-lg-7'
        self.helper.layout = Layout("full_name", 'email_address', 'phone_number', InlineRadios('best_contact'),
                                    'message', 'captcha')
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Submit'))

    full_name = forms.CharField(
        label="Name:",
        max_length=80,
        required=True,
    )

    email_address = forms.EmailField(
        label="Email:",
        max_length=80,
        required=True,
    )

    phone_number = forms.CharField(
        label="Phone Number:",
        required=False,
    )

    best_contact = forms.ChoiceField(
        choices=(
            ('Phone', "Phone"),
            ('Email', "Email"),
            ('Either', "Either"),
        ),
        label="How do you prefer to be contacted?",
        widget=forms.RadioSelect,
        initial='Either',
    )

    message = forms.CharField(
        label="What can we help you achieve?",
        required=True,
        widget=forms.Textarea
    )

    captcha = ReCaptchaField(
        attrs={'theme': 'clean'}
    )


class Comment(forms.Form):
    def __init__(self, *args, **kwargs):
        super(Comment, self).__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_class = 'form-horizontal'
        self.helper.label_class = 'col-lg-3'
        self.helper.field_class = 'col-lg-7'
        self.helper.layout = Layout("name", 'email_address', InlineRadios('first'), InlineRadios('second'),
                                    InlineRadios('third'), InlineRadios('fourth'), InlineRadios('fifth'),
                                    InlineRadios('sixth'), InlineRadios('seventh'), InlineRadios('eighth'),
                                    InlineRadios('ninth'), InlineRadios('tenth'), 'message1', 'message2')
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Submit'))

    name = forms.CharField(
        label="Name:",
        max_length=80,
        required=False,
    )

    email_address = forms.EmailField(
        label="Email:",
        max_length=80,
        required=False,
    )

    first = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Depth of the Knowledge of the subject",
        widget=forms.RadioSelect,
    )

    second = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Presentation Skills",
        widget=forms.RadioSelect,
    )

    third = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Sincerity, Commitment, Regularity and Punctuality",
        widget=forms.RadioSelect,
    )

    fourth = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Syllabus Coverage",
        widget=forms.RadioSelect,
    )

    fifth = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Ability to Clarify doubts, teaching with relevant examples",
        widget=forms.RadioSelect,
    )

    sixth = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Ability to relate the course to real life situations",
        widget=forms.RadioSelect,
    )

    seventh = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Ability to generate interest",
        widget=forms.RadioSelect,
    )

    eighth = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Accessibility of teachers for doubts and clarifications outside the class",
        widget=forms.RadioSelect,
    )

    ninth = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Ability to command and control the class",
        widget=forms.RadioSelect,
    )

    tenth = forms.ChoiceField(
        choices=(
            ('1', "1"),
            ('2', "2"),
            ('3', "3"),
            ('4', "4"),
        ),
        label="Overall teacher rating",
        widget=forms.RadioSelect,
    )

    message1 = forms.CharField(
        label="What can we do in the future to improve this class?",
        required=False,
        widget=forms.Textarea
    )

    message2 = forms.CharField(
        label="Is there any other suggestion or issues you would like to bring up?",
        required=False,
        widget=forms.Textarea
    )


class StudentIntakeForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super(StudentIntakeForm, self).__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_class = 'form-horizontal'
        self.helper.label_class = 'col-lg-3'
        self.helper.field_class = 'col-lg-7'
        self.helper.layout = Layout('name', 'email_address', 'instructor_name', 'git_hub', 'student_bio', 'student_goals')
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Submit'))

    name = forms.CharField(
        label="Name:",
        max_length=80,
        required=True,
    )

    email_address = forms.EmailField(
        label="Email:",
        max_length=80,
        required=True,
    )

    instructor_name = forms.CharField(
        label="Instructor's Name:",
        max_length=80,
        required=True,
    )

    git_hub = forms.CharField(
        label='GitHub URL:',
        max_length=200,
        required=True,
    )

    student_bio = forms.CharField(
        label='Tell us a little about yourself.',
        required=False,
        widget=forms.Textarea,
    )

    student_goals = forms.CharField(
        label='Tell us about your goals for this class.',
        required=False,
        widget=forms.Textarea,
    )

    class Meta:
        model = StudentIntake